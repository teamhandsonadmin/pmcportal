import { prisma } from '@/lib/prisma';
import type { ActivityEvent, DashboardStats } from '@/lib/types/tasks';
import { isItemDone } from '@/lib/types/tasks';
import { isOverdue } from '@/lib/utils/format';
import { isDependencySatisfied, type PrerequisiteTask } from '@/lib/utils/status-rules';
import { worstChecklistStatus } from '@/lib/utils/checklist-health';
import type { TaskRow } from '@/components/tasks/TasksExplorer';
import type { GraphEdgeInput } from '@/components/tasks/TaskDependencyGraph';

export interface WorkBreakdown {
  id: string;
  name: string;
  code: string;
  color: string;
  totalCount: number;
  readyCount: number;
  inProgressCount: number;
  blockedCount: number;
  completedCount: number;
  lastActivityAt: Date | null;
}

export async function getWorksData() {
  const [tasks, works, users, deps, parallelLinks, recentActivityRaw] = await Promise.all([
    prisma.task.findMany({
      include: {
        // category/itemLabel are read by the Gantt chart's checklist-health
        // indicator/tooltip (see lib/utils/checklist-health.ts) — the status
        // alone (as this select used to be) is enough for progressPct below,
        // but not enough to show which category/item is actually the problem.
        dependencyItems: { select: { category: true, itemLabel: true, completion: { select: { status: true } } } },
        work: { select: { id: true, name: true, code: true, color: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.work.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.userProfile.findMany({ select: { id: true, fullName: true } }),
    // Global/unscoped, matching the tasks fetch above — there is no
    // server-side "current project" concept on this page today (see
    // CHANGELOG_TASK_DEPENDENCIES.md); the existing client-side project
    // filter in TasksExplorer narrows what the graph shows.
    prisma.taskDependency.findMany({ select: { id: true, taskId: true, dependsOnTaskId: true, type: true } }),
    // Symmetric, non-blocking — deliberately NOT read anywhere near
    // prereqsByTask/stats below. Only ever used for the canvas's dashed
    // parallel-link rendering.
    prisma.taskParallelLink.findMany({ select: { id: true, taskAId: true, taskBId: true } }),
    prisma.activityLog.findMany({ orderBy: { createdAt: 'desc' }, take: 12 }),
  ]);

  const recentActivity: ActivityEvent[] = recentActivityRaw
    .filter((e) => e.taskId !== null)
    .map((e) => ({
      ...e,
      taskId: e.taskId!,
      payload: e.payload as Record<string, unknown> | null,
      actionType: e.actionType as ActivityEvent['actionType'],
    }));

  const workBreakdown: WorkBreakdown[] = works.map((w) => {
    const workTasks = tasks.filter((t) => t.workId === w.id);
    const lastActivityAt = workTasks.reduce<Date | null>((latest, t) => {
      return !latest || t.updatedAt > latest ? t.updatedAt : latest;
    }, null);

    return {
      id: w.id,
      name: w.name,
      code: w.code,
      color: w.color,
      totalCount: workTasks.length,
      readyCount: workTasks.filter((t) => t.status === 'ready').length,
      inProgressCount: workTasks.filter((t) => t.status === 'in_progress').length,
      blockedCount: workTasks.filter((t) => t.status === 'blocked').length,
      completedCount: workTasks.filter((t) => t.status === 'completed').length,
      lastActivityAt,
    };
  });

  const userMap = new Map(users.map((u) => [u.id, u.fullName]));

  // Prerequisite-completion counts for the flowchart's "X of Y done"
  // convergence badge — built from the same `tasks`/`deps` already fetched
  // above, not a second query (deps.dependsOnTaskId is the prerequisite;
  // deps.taskId is the task waiting on it).
  //
  // Only FS/SS-type edges are counted here, and deliberately not FF/SF —
  // this badge exists to communicate "is this task blocked from STARTING by
  // its prerequisites", which is exactly what FS/SS edges gate (see
  // getStartBlockingPrerequisites in status-rules.ts); an FF/SF edge never
  // blocks starting at all, so counting it here would misrepresent why a
  // task is (or isn't) still waiting. "Done" per prerequisite is also
  // type-aware via the same isDependencySatisfied() the real gating logic
  // uses — FS wants the prerequisite `completed`, SS only wants it started
  // (actualStartDate set), so an SS prerequisite that's merely in_progress
  // correctly still counts as "done" for THIS badge's purposes even though
  // it isn't finished, since it's no longer blocking this task's start.
  const prereqTaskById = new Map<string, PrerequisiteTask>(
    tasks.map((t) => [t.id, { id: t.id, taskId: t.taskId, taskName: t.taskName, status: t.status, actualStartDate: t.actualStartDate }])
  );
  const startGatingDepsByTask = new Map<string, { prereqId: string; type: typeof deps[number]['type'] }[]>();
  for (const d of deps) {
    if (d.type !== 'FS' && d.type !== 'SS') continue;
    if (!startGatingDepsByTask.has(d.taskId)) startGatingDepsByTask.set(d.taskId, []);
    startGatingDepsByTask.get(d.taskId)!.push({ prereqId: d.dependsOnTaskId, type: d.type });
  }

  const stats: DashboardStats = {
    readyCount: tasks.filter((t) => t.status === 'ready').length,
    inProgressCount: tasks.filter((t) => t.status === 'in_progress').length,
    blockedCount: tasks.filter((t) => t.status === 'blocked').length,
    completedCount: tasks.filter((t) => t.status === 'completed').length,
    totalCount: tasks.length,
  };

  const rows: TaskRow[] = tasks.map((t) => {
    const total = t.dependencyItems.length;
    const done = t.dependencyItems.filter((i) => isItemDone(i.completion?.status as never)).length;
    const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;

    // A completion row is created lazily (see DependencyCompletion's own
    // schema comment) — an item with none yet defaults to PENDING, same
    // fallback the checklist UI itself already uses.
    const checklistItems = t.dependencyItems.map((i) => ({
      category: i.category,
      itemLabel: i.itemLabel,
      status: i.completion?.status ?? 'PENDING',
    }));

    return {
      id: t.id,
      taskId: t.taskId,
      taskName: t.taskName,
      projectName: t.projectName,
      description: t.description,
      taskTypeId: t.taskTypeId,
      status: t.status,
      plannedStartDate: t.plannedStartDate,
      dueDate: t.dueDate,
      actualStartDate: t.actualStartDate,
      actualEndDate: t.actualEndDate,
      currentPlannedStartDate: t.currentPlannedStartDate,
      currentDueDate: t.currentDueDate,
      cascadeDelayDays: t.cascadeDelayDays,
      progressPct,
      overdue: isOverdue(t.dueDate) && t.status !== 'completed',
      assigneeName: t.assignedTo ? userMap.get(t.assignedTo) ?? null : null,
      workId: t.workId,
      workName: t.work?.name ?? 'Unassigned',
      workCode: t.work?.code ?? '—',
      workColor: t.work?.color ?? '#9CA3AF',
      manualPositionX: t.manualPositionX,
      manualPositionY: t.manualPositionY,
      checklistItems,
      worstChecklistStatus: worstChecklistStatus(checklistItems.map((i) => i.status)),
      prerequisiteCount: startGatingDepsByTask.get(t.id)?.length ?? 0,
      prerequisiteCompletedCount: (startGatingDepsByTask.get(t.id) ?? [])
        .filter(({ prereqId, type }) => {
          const prereqTask = prereqTaskById.get(prereqId);
          return !!prereqTask && isDependencySatisfied(type, prereqTask);
        }).length,
    };
  });

  const edges: GraphEdgeInput[] = deps.map((d) => ({ id: d.id, source: d.dependsOnTaskId, target: d.taskId, type: d.type }));
  const parallelEdges: GraphEdgeInput[] = parallelLinks.map((p) => ({ id: p.id, source: p.taskAId, target: p.taskBId }));

  return { tasks, works, stats, rows, edges, parallelEdges, workBreakdown, recentActivity };
}
