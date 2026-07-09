import { prisma } from '@/lib/prisma';
import type { ActivityEvent, DashboardStats } from '@/lib/types/hvac';
import { isItemDone } from '@/lib/types/hvac';
import { isOverdue } from '@/lib/utils/format';
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
  const [tasks, works, users, deps, recentActivityRaw] = await Promise.all([
    prisma.hvacTask.findMany({
      include: {
        dependencyItems: { select: { completion: { select: { status: true } } } },
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
    prisma.taskDependency.findMany({ select: { id: true, taskId: true, dependsOnTaskId: true } }),
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

    return {
      id: t.id,
      taskId: t.taskId,
      taskName: t.taskName,
      projectName: t.projectName,
      status: t.status,
      plannedStartDate: t.plannedStartDate,
      dueDate: t.dueDate,
      progressPct,
      overdue: isOverdue(t.dueDate) && t.status !== 'completed',
      assigneeName: t.assignedTo ? userMap.get(t.assignedTo) ?? null : null,
      workId: t.workId,
      workName: t.work?.name ?? 'Unassigned',
      workCode: t.work?.code ?? '—',
      workColor: t.work?.color ?? '#9CA3AF',
    };
  });

  const edges: GraphEdgeInput[] = deps.map((d) => ({ id: d.id, source: d.dependsOnTaskId, target: d.taskId }));

  return { tasks, works, stats, rows, edges, workBreakdown, recentActivity };
}
