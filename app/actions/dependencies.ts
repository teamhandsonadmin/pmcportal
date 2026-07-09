'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { UpdateDependencySchema } from '@/lib/validations/hvac';
import type { ActionResult, CompletionStatus, DependencyCategory } from '@/lib/types/hvac';

function revalidateTask(taskId: string) {
  revalidatePath(`/hvac/${taskId}/dependencies`);
  revalidatePath(`/hvac/${taskId}/overview`);
  revalidatePath(`/hvac/${taskId}`);
  revalidatePath('/hvac');
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

export async function deleteDependencyItem(itemId: string, taskId: string): Promise<ActionResult> {
  try {
    await prisma.dependencyItem.delete({ where: { id: itemId } });
  } catch {
    return { success: false, error: 'Failed to delete item' };
  }

  revalidateTask(taskId);
  return { success: true };
}

export async function updateDependencyCompletion(
  itemId: string,
  taskId: string,
  status: CompletionStatus,
  comment?: string | null
): Promise<ActionResult> {
  const parsed = UpdateDependencySchema.safeParse({ status, comment: comment ?? null });

  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  try {
    await prisma.dependencyCompletion.upsert({
      where: { itemId },
      create: {
        itemId,
        status: parsed.data.status as never,
        comment: parsed.data.comment ?? null,
        completedAt: parsed.data.status === 'delivered' ? new Date() : null,
      },
      update: {
        status: parsed.data.status as never,
        comment: parsed.data.comment ?? null,
        completedAt: parsed.data.status === 'delivered' ? new Date() : null,
      },
    });
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

  revalidatePath(`/hvac/${taskId}/dependencies`);
  revalidatePath(`/hvac/${taskId}/overview`);
  revalidatePath('/hvac');
  return { success: true };
}
