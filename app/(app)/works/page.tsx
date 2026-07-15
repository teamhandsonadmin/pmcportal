import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { StatsGrid } from '@/components/dashboard/StatsGrid';
import { RecentActivityFeed } from '@/components/dashboard/RecentActivityFeed';
import { getWorksData } from '@/lib/data/works';
import { formatRelativeTime } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';

export default async function WorksPage() {
  const [{ tasks, works, stats, workBreakdown, recentActivity }, project] = await Promise.all([
    getWorksData(),
    // This page has no server-side "current project" concept (works/tasks
    // are fetched globally, not scoped to one project — see
    // CHANGELOG_TASK_DEPENDENCIES.md) — the Settings link below just needs
    // *a* project to point at, and today there's exactly one. If a second
    // project is ever added, this picks the oldest one, which is likely
    // wrong; revisit then (e.g. a project switcher) rather than guessing now.
    prisma.project.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } }),
  ]);

  return (
    <div className="flex flex-col gap-5 h-full">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Tasks &amp; Works</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {tasks.length} tasks across {works.length} work{works.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {project && (
            <Link
              href={`/projects/${project.id}/settings`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-200 text-gray-700 text-[12.5px] font-medium hover:bg-gray-50 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              Settings
            </Link>
          )}
          <Link
            href="/works/flowchart"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gray-900 text-white text-[12.5px] font-medium hover:bg-black transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            View Flowchart
          </Link>
        </div>
      </div>

      <StatsGrid stats={stats} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Works breakdown */}
        <div className="xl:col-span-2">
          <div className="bg-card rounded-xl border border-border card-shadow overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <h2 className="text-[13px] font-semibold">Works</h2>
              <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md font-mono">
                {works.length} categories
              </span>
            </div>

            {workBreakdown.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-[12.5px] text-muted-foreground">No works yet — create a project first.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
                {workBreakdown.map((w) => (
                  <div
                    key={w.id}
                    className="relative rounded-lg border border-border hover:border-gray-400 hover:bg-gray-50 transition-colors"
                  >
                    {/* Card body opens the flowchart filtered to this work — an
                        absolutely-positioned overlay link (not the card's own
                        wrapping element) so the "+ Add Task" link below can sit
                        as an independent, separately-clickable sibling instead
                        of an invalid nested <a> inside this one. */}
                    <Link
                      href={`/works/flowchart?work=${w.code}`}
                      className="absolute inset-0 z-0"
                      aria-label={`View ${w.name} in flowchart`}
                    />

                    <div className="relative z-10 p-3.5 pointer-events-none">
                      <div className="flex items-center gap-2 mb-2.5 pr-7">
                        <span
                          className="w-5 h-5 rounded flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                          style={{ backgroundColor: w.color }}
                        >
                          {w.code.slice(0, 1)}
                        </span>
                        <span className="text-[13px] font-medium truncate flex-1">{w.name}</span>
                        <span className="text-[12px] font-semibold text-muted-foreground font-mono tabular-nums flex-shrink-0">
                          {w.totalCount}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap mb-2">
                        {w.inProgressCount > 0 && (
                          <Badge label={`${w.inProgressCount} active`} className="bg-blue-50 text-blue-700" />
                        )}
                        {w.blockedCount > 0 && (
                          <Badge label={`${w.blockedCount} not started`} className="bg-gray-100 text-gray-600" />
                        )}
                        {w.readyCount > 0 && (
                          <Badge label={`${w.readyCount} ready`} className="bg-amber-50 text-amber-700" />
                        )}
                        {w.completedCount > 0 && (
                          <Badge label={`${w.completedCount} done`} className="bg-emerald-50 text-emerald-700" />
                        )}
                        {w.totalCount === 0 && (
                          <span className="text-[11px] text-muted-foreground">No tasks yet</span>
                        )}
                      </div>

                      <p className="text-[10.5px] text-muted-foreground font-mono">
                        {w.lastActivityAt ? `Updated ${formatRelativeTime(w.lastActivityAt)}` : 'No activity yet'}
                      </p>
                    </div>

                    <Link
                      href={`/works/${w.id}/new`}
                      className="absolute top-3 right-3 z-20 w-5 h-5 flex items-center justify-center rounded-md bg-gray-900 text-white hover:bg-black transition-colors"
                      title={`Add task to ${w.name}`}
                      aria-label={`Add task to ${w.name}`}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="xl:col-span-1">
          <div className="bg-card rounded-xl border border-border card-shadow overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border">
              <h2 className="text-[13px] font-semibold">Recent Activity</h2>
            </div>
            <div className="p-3">
              <RecentActivityFeed events={recentActivity} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${className}`}>
      {label}
    </span>
  );
}
