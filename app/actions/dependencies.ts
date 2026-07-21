'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { UpdateDependencySchema } from '@/lib/validations/tasks';
import { getCurrentUserProfile } from '@/lib/auth/current-user';
import type { ActionResult, CompletionStatus, DependencyCategory, QuantityUnit } from '@/lib/types/tasks';

function revalidateTask(taskId: string) {
  revalidatePath(`/tasks/${taskId}/dependencies`);
  revalidatePath(`/tasks/${taskId}/overview`);
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath('/tasks');
  revalidatePath('/works');
}

// Ad-hoc, per-task checklist items — distinct from the project-wide
// dependency_template_items (see app/actions/dependency-templates.ts), which
// only seed *new* tasks going forward. This is how a task's own checklist
// gets customized/overridden after the fact.
export async function addDependencyItem(
  taskId: string,
  category: DependencyCategory,
  label: string
): Promise<ActionResult> {
  const trimmed = label.trim();
  if (trimmed.length < 3) return { success: false, error: 'Label must be at least 3 characters' };

  const maxSort = await prisma.dependencyItem.aggregate({
    where: { taskId, category },
    _max: { sortOrder: true },
  });

  try {
    await prisma.dependencyItem.create({
      data: {
        taskId,
        category,
        itemLabel: trimmed,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    });
  } catch {
    return { success: false, error: 'Failed to add item' };
  }

  revalidateTask(taskId);
  return { success: true };
}

export async function updateDependencyItemLabel(itemId: string, taskId: string, label: string): Promise<ActionResult> {
  const trimmed = label.trim();
  if (trimmed.length < 3) return { success: false, error: 'Label must be at least 3 characters' };

  try {
    await prisma.dependencyItem.update({ where: { id: itemId }, data: { itemLabel: trimmed } });
  } catch {
    return { success: false, error: 'Failed to update item' };
  }

  revalidateTask(taskId);
  return { success: true };
}

// The 'quantity' category's standard 4-item structure (rolled out to every
// task, see the one-off backfill that renamed the old 5 dummy placeholders).
// Matched by exact label rather than a dedicated flag/column since that's
// how the client themselves identified these roles when naming the items —
// a task that's been customized away from this exact label set (e.g. one
// with extra manually-added items) just doesn't get the auto-calc, which is
// the right fallback: no silent guessing about which item means what.
const QUANTITY_FORMULA_LABELS = {
  TARGETED: 'Targeted Quantity',
  DONE: 'Quantity Of Work Done',
  PENDING: 'Pending Quantity',
  EXCESS: 'Excess Quantity',
} as const;

// Pending Quantity = max(Targeted - Done, 0); Excess Quantity = max(Done -
// Targeted, 0) — exactly one of the two is ever positive at a time. An unset
// "Quantity Of Work Done" counts as 0 (nothing done yet, so 100% pending);
// an unset "Targeted Quantity" means there's nothing to compute against, so
// both stay unset rather than showing a misleading number.
async function recomputeQuantityFormula(taskId: string): Promise<void> {
  const rows = await prisma.dependencyItem.findMany({
    where: { taskId, category: 'quantity', itemLabel: { in: Object.values(QUANTITY_FORMULA_LABELS) } },
    select: { id: true, itemLabel: true, quantityUnit: true, quantityValue: true },
  });
  const targeted = rows.find((r) => r.itemLabel === QUANTITY_FORMULA_LABELS.TARGETED);
  const done = rows.find((r) => r.itemLabel === QUANTITY_FORMULA_LABELS.DONE);
  const pending = rows.find((r) => r.itemLabel === QUANTITY_FORMULA_LABELS.PENDING);
  const excess = rows.find((r) => r.itemLabel === QUANTITY_FORMULA_LABELS.EXCESS);
  if (!targeted || !done || !pending || !excess) return;

  if (targeted.quantityValue == null) {
    await prisma.$transaction([
      prisma.dependencyItem.update({ where: { id: pending.id }, data: { quantityUnit: null, quantityValue: null } }),
      prisma.dependencyItem.update({ where: { id: excess.id }, data: { quantityUnit: null, quantityValue: null } }),
    ]);
    return;
  }

  const unit = targeted.quantityUnit;
  const targetedVal = Number(targeted.quantityValue);
  const doneVal = done.quantityValue != null ? Number(done.quantityValue) : 0;

  await prisma.$transaction([
    prisma.dependencyItem.update({
      where: { id: pending.id },
      data: { quantityUnit: unit, quantityValue: Math.max(targetedVal - doneVal, 0) },
    }),
    prisma.dependencyItem.update({
      where: { id: excess.id },
      data: { quantityUnit: unit, quantityValue: Math.max(doneVal - targetedVal, 0) },
    }),
  ]);
}

// Quantity of work describes the ITEM itself, independent of its current
// status — one write for both fields together, not two separate saves.
export async function updateDependencyItemQuantity(
  itemId: string,
  taskId: string,
  unit: QuantityUnit,
  value: number
): Promise<ActionResult> {
  if (!Number.isFinite(value) || value <= 0) {
    return { success: false, error: 'Value must be a positive number' };
  }

  const item = await prisma.dependencyItem.findUnique({
    where: { id: itemId },
    select: { category: true, itemLabel: true },
  });
  if (!item) return { success: false, error: 'Item not found' };

  const isQuantityCategory = item.category === 'quantity';
  if (isQuantityCategory && (item.itemLabel === QUANTITY_FORMULA_LABELS.PENDING || item.itemLabel === QUANTITY_FORMULA_LABELS.EXCESS)) {
    return { success: false, error: 'This value is calculated automatically and cannot be edited directly' };
  }

  try {
    await prisma.dependencyItem.update({
      where: { id: itemId },
      data: { quantityUnit: unit as never, quantityValue: value },
    });

    if (isQuantityCategory && (item.itemLabel === QUANTITY_FORMULA_LABELS.TARGETED || item.itemLabel === QUANTITY_FORMULA_LABELS.DONE)) {
      await recomputeQuantityFormula(taskId);
    }
  } catch {
    return { success: false, error: 'Failed to save quantity' };
  }

  revalidateTask(taskId);
  return { success: true };
}

export async function deleteDependencyItem(itemId: string, taskId: string): Promise<ActionResult> {
  try {
    await prisma.dependencyItem.delete({ where: { id: itemId } });
  } catch {
    return { success: false, error: 'Failed to delete item' };
  }

  revalidateTask(taskId);
  return { success: true };
}

// No longer takes/writes a comment — real threaded comments live in the
// Comment model now (see CommentThreadModal + app/actions/comments.ts).
// DependencyCompletion.comment is left untouched by this (neither cleared
// nor overwritten) since something else may still read the old value.
export async function updateDependencyCompletion(
  itemId: string,
  taskId: string,
  status: CompletionStatus
): Promise<ActionResult> {
  const parsed = UpdateDependencySchema.safeParse({ status });

  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const nextStatus = parsed.data.status;

  try {
    const existing = await prisma.dependencyCompletion.findUnique({
      where: { itemId },
      select: { status: true },
    });
    const changed = (existing?.status ?? 'PENDING') !== nextStatus;

    if (changed) {
      const actor = await getCurrentUserProfile();
      await prisma.$transaction([
        prisma.dependencyCompletion.upsert({
          where: { itemId },
          create: { itemId, status: nextStatus as never, completedAt: nextStatus === 'YES' ? new Date() : null },
          update: { status: nextStatus as never, completedAt: nextStatus === 'YES' ? new Date() : null },
        }),
        // oldStatus is null only when no completion row existed yet at all
        // (the implicit PENDING default) — a real recorded PENDING status
        // still gets carried forward as oldStatus on its own next change.
        prisma.dependencyStatusHistory.create({
          data: {
            dependencyItemId: itemId,
            oldStatus: existing ? (existing.status as never) : null,
            newStatus: nextStatus as never,
            changedBy: actor?.id ?? null,
          },
        }),
      ]);
    } else {
      await prisma.dependencyCompletion.upsert({
        where: { itemId },
        create: { itemId, status: nextStatus as never, completedAt: nextStatus === 'YES' ? new Date() : null },
        update: { status: nextStatus as never, completedAt: nextStatus === 'YES' ? new Date() : null },
      });
    }
  } catch {
    return { success: false, error: 'Failed to update checklist item' };
  }

  await prisma.activityLog.create({
    data: {
      taskId,
      actionType: 'checklist_update',
      payload: { itemId, status: parsed.data.status },
    },
  }).catch(() => {});

  revalidatePath(`/tasks/${taskId}/dependencies`);
  revalidatePath(`/tasks/${taskId}/overview`);
  revalidatePath('/tasks');
  return { success: true };
}

export interface StatusHistoryEntry {
  id: string;
  oldStatus: CompletionStatus | null;
  newStatus: CompletionStatus;
  changedByName: string | null;
  changedAt: Date;
}

export async function getDependencyStatusHistory(itemId: string): Promise<StatusHistoryEntry[]> {
  const rows = await prisma.dependencyStatusHistory.findMany({
    where: { dependencyItemId: itemId },
    orderBy: { changedAt: 'desc' },
    include: { changer: { select: { fullName: true } } },
  });

  return rows.map((r) => ({
    id: r.id,
    oldStatus: r.oldStatus as CompletionStatus | null,
    newStatus: r.newStatus as CompletionStatus,
    changedByName: r.changer?.fullName ?? null,
    changedAt: r.changedAt,
  }));
}
