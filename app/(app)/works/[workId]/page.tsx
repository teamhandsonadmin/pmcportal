import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { TaskCard, TaskListHeader } from '@/components/hvac/TaskCard';
import { StatsGrid } from '@/components/dashboard/StatsGrid';
import { TaskFlowMap } from '@/components/tasks/TaskFlowMap';
import { RecentActivityFeed } from '@/components/dashboard/RecentActivityFeed';
import type { DashboardStats, HvacTask, CategoryProgress, ActivityEvent } from '@/lib/types/hvac';
import { isItemDone } from '@/lib/types/hvac';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ workId: string }>;
}

async function getWorkData(workId: string) {
  const [work, tasks, activity, depItems] = await Promise.allSettled([
    prisma.work.findUnique({ where: { id: workId } }),
    prisma.hvacTask.findMany({ where: { workId }, orderBy: { createdAt: 'asc' } }),
    prisma.activityLog.findMany({
      where: { task: { workId } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.dependencyItem.findMany({
      where: { task: { workId } },
      include: { completion: true },
    }),
  ]);
  return { work, tasks, activity, depItems };
}

export default async function WorkTaskListPage({ params }: Props) {
  const { workId } = await params;
  const { work: workRes, tasks: tasksRes, activity: activityRes, depItems: depItemsRes } = await getWorkData(workId);

  const work = workRes.status === 'fulfilled' ? workRes.value : null;
  if (!work) notFound();

  const tasks: HvacTask[] = tasksRes.status === 'fulfilled' ? tasksRes.value : [];
  const activity: ActivityEvent[] = (activityRes.status === 'fulfilled' ? activityRes.value : [])
    .filter((e) => e.taskId !== null)
    .map((e) => ({ ...e, taskId: e.taskId!, payload: e.payload as Record<string, unknown> | null, actionType: e.actionType as ActivityEvent['actionType'] }));
  const depItems = depItemsRes.status === 'fulfilled' ? depItemsRes.value : [];

  const stats: DashboardStats = {
    readyCount:      tasks.filter((t) => t.status === 'ready').length,
    inProgressCount: tasks.filter((t) => t.status === 'in_progress').length,
    blockedCount:    tasks.filter((t) => t.status === 'blocked').length,
    completedCount:  tasks.filter((t) => t.status === 'completed').length,
    totalCount:      tasks.length,
  };

  function taskProgress(taskId: string): CategoryProgress[] {
    const taskItems = depItems.filter((i) => i.taskId === taskId);
    const categories = ['architect', 'client', 'consultant', 'contractor', 'inspector'] as const;
    return categories.map((cat) => {
      const catItems = taskItems.filter((i) => i.category === cat);
      const completed = catItems.filter((i) => isItemDone(i.completion?.status as never)).length;
      const total = catItems.length;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
      return { taskId, category: cat, totalItems: total, completedItems: completed, completionPct: pct, categoryComplete: total > 0 && completed === total };
    });
  }

  const flowTasks = tasks.map((t) => {
    const progress = taskProgress(t.id);
    const totalItems = progress.reduce((s, p) => s + p.totalItems, 0);
    const doneItems  = progress.reduce((s, p) => s + p.completedItems, 0);
    const pct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
    return { id: t.id, taskId: t.taskId, taskName: t.taskName, status: t.status, completionPct: pct };
  });

  return (
    <div>
      {/* Work header */}
      <div className="flex items-start justify-between gap-4 mb-7">
        <div>
          <Link
            href="/works"
            className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            All Works
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
              {work.code.slice(0, 2)}
            </div>
            <div>
              <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{work.name}</h1>
              {work.description && (
                <p className="text-[13px] text-muted-foreground">{work.description}</p>
              )}
            </div>
          </div>
        </div>
        <Link
          href={`/works/${workId}/new`}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium text-white bg-gray-900 hover:bg-black transition-colors flex-shrink-0 mt-8"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          New Task
        </Link>
      </div>

      <StatsGrid stats={stats} />

      {/* Flow map */}
      {tasks.length > 0 && (
        <div className="mb-5">
          <div className="bg-card rounded-xl border border-border card-shadow overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <div>
                <h2 className="text-[13px] font-semibold">Task Flow</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">Work sequence — click any task to view its checklists</p>
              </div>
              <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md font-mono">
                {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
              </span>
            </div>
            <div className="p-5">
              <TaskFlowMap tasks={flowTasks} />
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2">
          <div className="bg-card rounded-xl border border-border card-shadow overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <h2 className="text-[13px] font-semibold">All Tasks</h2>
              <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md font-mono">
                {tasks.length} tasks
              </span>
            </div>

            {tasks.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <path d="M14 2v6h6M12 18v-6M9 15h6"/>
                  </svg>
                </div>
                <p className="text-sm font-medium mb-1">No tasks yet</p>
                <p className="text-[12px] text-muted-foreground mb-4">Create the first task for this work</p>
                <Link
                  href={`/works/${workId}/new`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium text-white bg-gray-900 hover:bg-black transition-colors"
                >
                  + New Task
                </Link>
              </div>
            ) : (
              <>
                <TaskListHeader />
                <div>
                  {[...tasks].reverse().map((task) => (
                    <TaskCard key={task.id} task={task} progress={taskProgress(task.id)} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="xl:col-span-1 space-y-4">
          <div className="bg-card rounded-xl border border-border card-shadow overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border">
              <h2 className="text-[13px] font-semibold">Recent Activity</h2>
            </div>
            <div className="p-3">
              <RecentActivityFeed events={activity} />
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border card-shadow overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border">
              <h2 className="text-[13px] font-semibold">Task Health</h2>
            </div>
            <div className="p-5 space-y-3">
              {[
                { label: 'On Track',  count: stats.readyCount + stats.inProgressCount },
                { label: 'Blocked',   count: stats.blockedCount },
                { label: 'Completed', count: stats.completedCount },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                    <span className="text-[12.5px] text-muted-foreground">{row.label}</span>
                  </div>
                  <span className="text-[11.5px] font-semibold px-2 py-0.5 rounded font-mono tabular-nums text-gray-700 bg-gray-100">
                    {row.count}
                  </span>
                </div>
              ))}
              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-muted-foreground">Overall completion</span>
                  <span className="text-[11px] font-mono font-semibold tabular-nums">
                    {stats.totalCount > 0 ? Math.round((stats.completedCount / stats.totalCount) * 100) : 0}%
                  </span>
                </div>
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gray-800 rounded-full transition-all"
                    style={{
                      width: stats.totalCount > 0 ? `${Math.round((stats.completedCount / stats.totalCount) * 100)}%` : '0%',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
