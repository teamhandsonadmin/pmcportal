import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { StatsGrid } from '@/components/dashboard/StatsGrid';
import { TasksExplorer } from '@/components/tasks/TasksExplorer';
import type { DashboardStats } from '@/lib/types/hvac';
import { isItemDone } from '@/lib/types/hvac';
import { isOverdue } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';

export default async function WorksPage() {
  const [tasks, works, users, deps] = await Promise.all([
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
  ]);

  const userMap = new Map(users.map((u) => [u.id, u.fullName]));

  const stats: DashboardStats = {
    readyCount: tasks.filter((t) => t.status === 'ready').length,
    inProgressCount: tasks.filter((t) => t.status === 'in_progress').length,
    blockedCount: tasks.filter((t) => t.status === 'blocked').length,
    completedCount: tasks.filter((t) => t.status === 'completed').length,
    totalCount: tasks.length,
  };

  const rows = tasks.map((t) => {
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

  const edges = deps.map((d) => ({ id: d.id, source: d.dependsOnTaskId, target: d.taskId }));

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Tasks &amp; Works</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {tasks.length} tasks across {works.length} work{works.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <StatsGrid stats={stats} />

      {/* Quick-create: pick a work to add a task under */}
      <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
        <span className="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-widest mr-1">New Task In:</span>
        {works.map((w) => (
          <Link
            key={w.id}
            href={`/works/${w.id}/new`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[12px] font-medium hover:border-gray-400 hover:bg-gray-50 transition-colors"
          >
            <span className="w-4 h-4 rounded flex items-center justify-center text-white text-[8px] font-bold" style={{ backgroundColor: w.color }}>
              {w.code.slice(0, 1)}
            </span>
            {w.name}
          </Link>
        ))}
        {works.length === 0 && (
          <span className="text-[12px] text-muted-foreground">No works yet — create a project first.</span>
        )}
      </div>

      <TasksExplorer rows={rows} edges={edges} />
    </div>
  );
}
