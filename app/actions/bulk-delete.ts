'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import type { Prisma } from '@/lib/generated/prisma';
import type { ActionResult, TaskStatus } from '@/lib/types/tasks';

// Mirrors exactly the filters TasksExplorer already applies client-side
// (search/work/status/assignee/project) so "clear all tasks" only ever
// touches what the admin can currently see matching those filters — never
// a silently wider set. `projectName` empty/null means "All Projects", the
// intentionally larger blast radius the UI gates behind a stronger typed
// confirmation phrase.
export interface BulkDeleteScope {
  search: string;
  workCode: string;
  status: TaskStatus | '';
  assigneeName: string;
  projectName: string;
}

export interface BulkDeletePreview {
  taskCount: number;
  dependencyItemCount: number;
  dependencyLinkCount: number;
}

async function buildScopeWhere(scope: BulkDeleteScope): Promise<Prisma.TaskWhereInput> {
  const where: Prisma.TaskWhereInput = {};
  if (scope.projectName) where.projectName = scope.projectName;
  if (scope.workCode) where.work = { code: scope.workCode };
  if (scope.status) where.status = scope.status;
  if (scope.search) {
    where.OR = [
      { taskName: { contains: scope.search, mode: 'insensitive' } },
      { taskId: { contains: scope.search, mode: 'insensitive' } },
    ];
  }
  if (scope.assigneeName) {
    // TaskRow only carries the resolved display name, not the underlying
    // UserProfile id, so resolve name -> id(s) the same way the client-side
    // filter effectively does (matching on the same displayed string).
    const users = await prisma.userProfile.findMany({
      where: { fullName: scope.assigneeName },
      select: { id: true },
    });
    where.assignedTo = { in: users.map((u) => u.id) };
  }
  return where;
}

// Read-only — powers the Stage 1 confirmation dialog's live counts. Always
// re-queries at call time (never trusts a client-held count), so reopening
// the dialog (or the Stage 1 -> Stage 2 transition re-calling this) reflects
// tasks added/removed since it was last shown.
export async function getBulkDeletePreview(scope: BulkDeleteScope): Promise<ActionResult<BulkDeletePreview>> {
  const where = await buildScopeWhere(scope);
  const taskIds = (await prisma.task.findMany({ where, select: { id: true } })).map((t) => t.id);

  if (taskIds.length === 0) {
    return { success: true, data: { taskCount: 0, dependencyItemCount: 0, dependencyLinkCount: 0 } };
  }

  const [dependencyItemCount, dependencyLinkCount] = await Promise.all([
    prisma.dependencyItem.count({ where: { taskId: { in: taskIds } } }),
    prisma.taskDependency.count({
      where: { OR: [{ taskId: { in: taskIds } }, { dependsOnTaskId: { in: taskIds } }] },
    }),
  ]);

  return { success: true, data: { taskCount: taskIds.length, dependencyItemCount, dependencyLinkCount } };
}

function expectedPhraseFor(scope: BulkDeleteScope): string {
  return scope.projectName ? scope.projectName : 'DELETE ALL TASKS';
}

// The actual bulk delete. `typedPhrase` is re-checked here too (not just
// disabling a button client-side) so a request can't skip Stage 2 by
// calling this directly. Deletion itself re-derives the matching task set
// fresh inside the transaction — never the set the client saw when the
// dialog opened — then deletes it, then writes exactly one ActivityLog
// summary row, all atomically: if either step fails, nothing is deleted.
export async function bulkDeleteTasks(
  scope: BulkDeleteScope,
  typedPhrase: string
): Promise<ActionResult<{ deletedCount: number }>> {
  if (typedPhrase !== expectedPhraseFor(scope)) {
    return { success: false, error: 'Confirmation phrase does not match.' };
  }

  let deletedCount: number;
  try {
    deletedCount = await prisma.$transaction(async (tx) => {
      const where = await buildScopeWhere(scope);
      const matching = await tx.task.findMany({ where, select: { id: true } });
      const ids = matching.map((t) => t.id);

      if (ids.length === 0) return 0;

      const { count } = await tx.task.deleteMany({ where: { id: { in: ids } } });

      await tx.activityLog.create({
        data: {
          taskId: null,
          actionType: 'bulk_task_deletion',
          payload: { scope: { ...scope }, deletedCount: count } satisfies Prisma.InputJsonValue,
        },
      });

      return count;
    });
  } catch {
    return { success: false, error: 'Bulk delete failed — nothing was deleted.' };
  }

  // The delete has already committed by this point — a cache-revalidation
  // hiccup here is a staleness nuisance, not a reason to tell the admin
  // their (successful) deletion failed, so it's deliberately outside the
  // try/catch above and never turns a real success into a reported failure.
  try {
    revalidatePath('/works');
    revalidatePath('/works/flowchart');
    revalidatePath('/gantt');
  } catch {
    // best-effort — the delete itself already succeeded
  }

  return { success: true, data: { deletedCount } };
}
