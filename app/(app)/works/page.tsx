import Link from 'next/link';
import { StatsGrid } from '@/components/dashboard/StatsGrid';
import { RecentActivityFeed } from '@/components/dashboard/RecentActivityFeed';
import { getWorksData } from '@/lib/data/works';
import { formatRelativeTime } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';

export default async function WorksPage() {
  const { tasks, works, stats, workBreakdown, recentActivity } = await getWorksData();

  return (
    <div className="flex flex-col gap-5 h-full">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Tasks &amp; Works</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {tasks.length} tasks across {works.length} work{works.length === 1 ? '' : 's'}
          </p>
        </div>
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
                  <Link
                    key={w.id}
                    href={`/works/${w.id}`}
                    className="rounded-lg border border-border p-3.5 hover:border-gray-400 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2.5">
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
                  </Link>
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
