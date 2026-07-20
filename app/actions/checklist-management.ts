'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getCurrentUserProfile } from '@/lib/auth/current-user';
import type { ActionResult, CompletionStatus, DependencyCategory } from '@/lib/types/tasks';

const STATUSES: CompletionStatus[] = ['YES', 'NO', 'ON_HOLD', 'PENDING', 'REVISIONS', 'PROCEED'];

// Pilot scope only — the first 11 Civil-trade tasks by planned start date
// (ties broken by taskId, which naturally lands on all of Set 1's main +
// parallel columns plus Set 2's first task; confirmed against the real data
// before picking this). Expanding to all 311 tasks is a deliberate follow-up
// once this pilot is reviewed, not something this page tries to do itself.
export async function getPilotTaskIds(): Promise<string[]> {
  const civilWork = await prisma.work.findFirst({ where: { code: 'CIVIL' }, select: { id: true } });
  if (!civilWork) return [];
  const tasks = await prisma.task.findMany({
    where: { workId: civilWork.id },
    select: { id: true },
    orderBy: [{ plannedStartDate: 'asc' }, { taskId: 'asc' }],
    take: 11,
  });
  return tasks.map((t) => t.id);
}

export interface ChecklistManagementTask {
  id: string;
  taskId: string;
  taskName: string;
  workCode: string;
  plannedStartDate: Date | null;
  dueDate: Date | null;
}

export interface ChecklistCategoryColumn {
  category: DependencyCategory;
  itemLabels: string[];
}

export interface ChecklistCell {
  itemId: string;
  status: CompletionStatus;
}

export interface ChecklistManagementData {
  tasks: ChecklistManagementTask[];
  categories: ChecklistCategoryColumn[];
  // keyed "<taskId>::<category>::<itemLabel>" -> cell. A task genuinely
  // missing that exact item (the one confirmed non-uniform case, Procurement's
  // first two items swapping order on some tasks) simply has no entry here —
  // callers render an empty cell rather than assuming every task has every
  // column.
  cells: Record<string, ChecklistCell>;
}

// Deliberately excludes 'quantity' (a separate, newer tracking category, not
// one of these departments) and 'inspector' (retired — zero items on any
// task; its one surviving item moved under Procurement — see lib/types/tasks.ts).
const DEPARTMENT_CATEGORIES: DependencyCategory[] = ['architect', 'client', 'consultant', 'contractor', 'procurement'];

export async function getChecklistManagementData(taskIds: string[]): Promise<ChecklistManagementData> {
  const tasks = await prisma.task.findMany({
    where: { id: { in: taskIds } },
    select: { id: true, taskId: true, taskName: true, plannedStartDate: true, dueDate: true, work: { select: { code: true } } },
  });
  // Preserve the caller's own ordering (the pilot's planned-start-date order),
  // not whatever order the DB happens to return findMany rows in.
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const orderedTasks: ChecklistManagementTask[] = taskIds
    .map((id) => taskById.get(id))
    .filter((t): t is NonNullable<typeof t> => !!t)
    .map((t) => ({
      id: t.id,
      taskId: t.taskId,
      taskName: t.taskName,
      workCode: t.work?.code ?? '—',
      plannedStartDate: t.plannedStartDate,
      dueDate: t.dueDate,
    }));

  const items = await prisma.dependencyItem.findMany({
    where: { taskId: { in: taskIds }, category: { in: DEPARTMENT_CATEGORIES } },
    select: { id: true, taskId: true, category: true, itemLabel: true, sortOrder: true, completion: { select: { status: true } } },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
  });

  // Column order per category: first-seen order while walking items sorted
  // by sortOrder — stable, and tolerant of the one known non-uniform case
  // (two tasks disagreeing on sortOrder for the same two Procurement items)
  // without either crashing or silently dropping a column.
  const itemLabelsByCategory = new Map<DependencyCategory, string[]>();
  const seenByCategory = new Map<DependencyCategory, Set<string>>();
  const cells: Record<string, ChecklistCell> = {};

  for (const item of items) {
    if (!itemLabelsByCategory.has(item.category)) {
      itemLabelsByCategory.set(item.category, []);
      seenByCategory.set(item.category, new Set());
    }
    const seen = seenByCategory.get(item.category)!;
    if (!seen.has(item.itemLabel)) {
      seen.add(item.itemLabel);
      itemLabelsByCategory.get(item.category)!.push(item.itemLabel);
    }
    cells[`${item.taskId}::${item.category}::${item.itemLabel}`] = {
      itemId: item.id,
      status: item.completion?.status ?? 'PENDING',
    };
  }

  const categories: ChecklistCategoryColumn[] = DEPARTMENT_CATEGORIES.map((category) => ({
    category,
    itemLabels: itemLabelsByCategory.get(category) ?? [],
  }));

  return { tasks: orderedTasks, categories, cells };
}

export interface BulkApplyInput {
  taskIds: string[];
  category: DependencyCategory;
  itemLabel: string;
  status: CompletionStatus;
}

export interface BulkApplyResult {
  updatedCount: number;
}

// One bulk write (a single transaction covering every matched item), not a
// status update looped one row at a time in the UI — and exactly one
// ActivityLog entry describing the whole action, not one per affected task.
// Writes to the SAME DependencyCompletion rows the per-task checklist reads
// and writes — this is a different view over one shared data model, not a
// parallel copy of it, so a change here shows up on /tasks/[taskId] too and
// vice versa.
export async function bulkApplyChecklistStatus(input: BulkApplyInput): Promise<ActionResult<BulkApplyResult>> {
  if (!STATUSES.includes(input.status)) {
    return { success: false, error: 'Invalid status' };
  }
  if (input.taskIds.length === 0) {
    return { success: false, error: 'No tasks selected' };
  }

  const items = await prisma.dependencyItem.findMany({
    where: { taskId: { in: input.taskIds }, category: input.category, itemLabel: input.itemLabel },
    select: { id: true, taskId: true },
  });
  if (items.length === 0) {
    return { success: false, error: 'No matching checklist items found for the selected tasks' };
  }

  const completedAt = input.status === 'YES' ? new Date() : null;
  await prisma.$transaction(
    items.map((item) =>
      prisma.dependencyCompletion.upsert({
        where: { itemId: item.id },
        create: { itemId: item.id, status: input.status, completedAt },
        update: { status: input.status, completedAt },
      })
    )
  );

  const currentUser = await getCurrentUserProfile();
  await prisma.activityLog.create({
    data: {
      taskId: null,
      userId: currentUser?.id ?? null,
      actionType: 'bulk_checklist_update',
      payload: {
        category: input.category,
        itemLabel: input.itemLabel,
        status: input.status,
        taskIds: items.map((i) => i.taskId),
        updatedCount: items.length,
      },
    },
  }).catch(() => {});

  revalidatePath('/works/checklists');
  for (const item of items) {
    revalidatePath(`/tasks/${item.taskId}`);
    revalidatePath(`/tasks/${item.taskId}/dependencies`);
    revalidatePath(`/tasks/${item.taskId}/overview`);
  }
  revalidatePath('/tasks');

  return { success: true, data: { updatedCount: items.length } };
}
