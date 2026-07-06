import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { AutoRefresh } from '@/components/dashboard/AutoRefresh';
import { RecentActivityFeed } from '@/components/dashboard/RecentActivityFeed';
import { isItemDone } from '@/lib/types/hvac';
import { isOverdue } from '@/lib/utils/format';
import type { ActivityEvent } from '@/lib/types/hvac';

export const dynamic = 'force-dynamic';

const DAY_MS = 24 * 60 * 60 * 1000;
const FORECAST_WINDOW_DAYS = 14;

async function getDashboardData() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const windowStart = new Date(now.getTime() - FORECAST_WINDOW_DAYS * DAY_MS);

  const [projects, tasks, depItems, deliveredToday, deliveredInWindow, recentActivityRaw] = await Promise.all([
    prisma.project.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        works: {
          include: {
            tasks: { select: { id: true, status: true } },
          },
        },
      },
    }),
    prisma.hvacTask.findMany({ select: { id: true, status: true, dueDate: true } }),
    prisma.dependencyItem.findMany({
      where: { isMandatory: true },
      select: { completion: { select: { status: true } } },
    }),
    prisma.dependencyCompletion.count({
      where: { status: 'delivered', completedAt: { gte: startOfToday } },
    }),
    prisma.dependencyCompletion.count({
      where: { status: 'delivered', completedAt: { gte: windowStart } },
    }),
    prisma.activityLog.findMany({
      where: { taskId: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
  ]);

  const recentActivity: ActivityEvent[] = recentActivityRaw.map((e) => ({
    ...e,
    taskId: e.taskId!,
    payload: e.payload as Record<string, unknown> | null,
    actionType: e.actionType as ActivityEvent['actionType'],
  }));

  // Completion forecast — velocity over trailing window, projected against remaining items.
  // Computed here (not in the component body) so render stays free of Date construction.
  const totalDepItems = depItems.length;
  const doneDepItems = depItems.filter((i) => isItemDone(i.completion?.status as never)).length;
  const velocityPerDay = deliveredInWindow / FORECAST_WINDOW_DAYS;
  const remainingDepItems = totalDepItems - doneDepItems;
  const forecastDays = velocityPerDay > 0 ? Math.ceil(remainingDepItems / velocityPerDay) : null;
  const forecastDate = forecastDays !== null ? new Date(now.getTime() + forecastDays * DAY_MS) : null;

  return {
    projects, tasks, depItems, deliveredToday, recentActivity,
    totalDepItems, doneDepItems, velocityPerDay, forecastDays, forecastDate,
  };
}

export default async function DashboardPage() {
  const {
    projects, tasks, deliveredToday, recentActivity,
    totalDepItems, doneDepItems, velocityPerDay, forecastDays, forecastDate,
  } = await getDashboardData();

  // KPIs
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress').length;
  const blockedTasks = tasks.filter((t) => t.status === 'blocked').length;
  const delayedTasks = tasks.filter((t) => isOverdue(t.dueDate) && t.status !== 'completed').length;

  // Dependency health
  const depCompletionPct = totalDepItems > 0 ? Math.round((doneDepItems / totalDepItems) * 100) : 0;

  // Daily progress % — checklist items ("task points") delivered today over all mandatory items
  const dailyProgressPct = totalDepItems > 0 ? Math.round((deliveredToday / totalDepItems) * 100) : 0;

  const projectCards = projects.map((p) => {
    const allTasks = p.works.flatMap((w) => w.tasks);
    const done = allTasks.filter((t) => t.status === 'completed').length;
    const pct = allTasks.length > 0 ? Math.round((done / allTasks.length) * 100) : 0;
    return { id: p.id, name: p.name, worksCount: p.works.length, tasksCount: allTasks.length, pct };
  });

  return (
    <div className="space-y-4">
      <AutoRefresh intervalMs={30_000} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">
            {projects.length} project{projects.length === 1 ? '' : 's'} · {totalTasks} tasks tracked
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 border border-green-200">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[11px] font-semibold text-green-700">Live — refreshes every 30s</span>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3.5">
        {[
          { label: 'Total Tasks', value: totalTasks, sub: `${projects.reduce((s, p) => s + p.works.length, 0)} works tracked` },
          { label: 'Completed Tasks', value: completedTasks, sub: totalTasks > 0 ? `${Math.round((completedTasks / totalTasks) * 100)}% done rate` : 'No tasks yet' },
          { label: 'Tasks In Progress', value: inProgressTasks, sub: 'Active work items' },
          { label: 'Delayed Tasks', value: delayedTasks, sub: blockedTasks > 0 ? `${blockedTasks} also blocked on deps` : 'Past due date' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-white border border-gray-100 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <p className="text-[11.5px] font-semibold text-gray-400 uppercase tracking-wider mb-3">{s.label}</p>
            <span className="text-[34px] font-black text-gray-900 leading-none tabular-nums">{s.value}</span>
            <div className="mt-3 pt-3 border-t border-gray-50">
              <span className="text-[11.5px] text-gray-400">{s.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Daily progress + Forecast + Dependency health */}
      <div className="grid grid-cols-3 gap-3.5">
        <div className="rounded-2xl bg-white border border-gray-100 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <p className="text-[11.5px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Daily Progress</p>
          <span className="text-[30px] font-black text-gray-900 leading-none tabular-nums">{dailyProgressPct}%</span>
          <p className="text-[11.5px] text-gray-400 mt-2">
            {deliveredToday} of {totalDepItems} checklist items delivered today
          </p>
        </div>

        <div className="rounded-2xl bg-white border border-gray-100 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <p className="text-[11.5px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Completion Forecast</p>
          {forecastDate ? (
            <>
              <span className="text-[20px] font-black text-gray-900 leading-none tabular-nums">
                {forecastDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <p className="text-[11.5px] text-gray-400 mt-2">
                ~{forecastDays} day{forecastDays === 1 ? '' : 's'} at current pace ({velocityPerDay.toFixed(1)} items/day)
              </p>
            </>
          ) : (
            <>
              <span className="text-[18px] font-bold text-gray-400 leading-none">Not enough data yet</span>
              <p className="text-[11.5px] text-gray-400 mt-2">Forecast appears once checklist items start being delivered.</p>
            </>
          )}
        </div>

        <div className="rounded-2xl bg-white border border-gray-100 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11.5px] font-semibold text-gray-400 uppercase tracking-wider">Dependency Health</p>
            <Link href="/hvac" className="text-[11px] font-semibold text-gray-400 hover:text-gray-900 transition-colors">Manage →</Link>
          </div>
          <span className="text-[30px] font-black text-gray-900 leading-none tabular-nums">{depCompletionPct}%</span>
          <p className="text-[11.5px] text-gray-400 mt-2">
            {doneDepItems}/{totalDepItems} items cleared · {blockedTasks} task{blockedTasks === 1 ? '' : 's'} blocked
          </p>
        </div>
      </div>

      {/* Projects + Recent Activity */}
      <div className="grid grid-cols-3 gap-3.5">
        <div className="col-span-2 rounded-2xl bg-white border border-gray-100 overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-50">
            <h3 className="text-[13.5px] font-bold text-gray-900 tracking-tight">Projects</h3>
            <Link href="/projects/new" className="text-[11.5px] font-semibold text-white bg-gray-900 hover:bg-gray-800 px-3 py-1.5 rounded-lg transition-colors">
              + Add Project
            </Link>
          </div>
          {projectCards.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-[13px] text-gray-400 mb-3">No projects yet.</p>
              <Link href="/projects/new" className="text-[12.5px] font-semibold text-gray-900 underline">Create your first project</Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {projectCards.map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/60 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-gray-900 truncate">{p.name}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{p.worksCount} works · {p.tasksCount} tasks</p>
                  </div>
                  <div className="w-32 flex-shrink-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10.5px] text-gray-400">Complete</span>
                      <span className="text-[11px] font-bold text-gray-900 tabular-nums">{p.pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full bg-gray-900" style={{ width: `${p.pct}%` }} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="px-5 pt-5 pb-4 border-b border-gray-50">
            <h3 className="text-[13.5px] font-bold text-gray-900 tracking-tight">Recent Activity</h3>
          </div>
          <div className="p-2">
            <RecentActivityFeed events={recentActivity} />
          </div>
        </div>
      </div>

      {/* Coming soon placeholders */}
      <div className="grid grid-cols-3 gap-3.5">
        {[
          { title: 'Attendance', desc: 'Site attendance tracking' },
          { title: 'Daily Progress Reports', desc: 'DPR submission tracking' },
          { title: 'Site Photos', desc: 'Photo uploads per site visit' },
        ].map((s) => (
          <div key={s.title} className="rounded-2xl border-2 border-dashed border-gray-200 p-5 flex flex-col items-center justify-center text-center gap-1.5 min-h-[120px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-300 bg-gray-50 px-2 py-0.5 rounded-full">Coming Soon</span>
            <p className="text-[13px] font-semibold text-gray-400 mt-1">{s.title}</p>
            <p className="text-[11px] text-gray-300">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
