import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { DprFilterBar } from '@/components/dpr/DprFilterBar';
import { DprRealtimeRefresher } from '@/components/dpr/DprRealtimeRefresher';
import { formatDate } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';

const RECORD_LIMIT = 500;
const WEATHER_LABELS: Record<string, string> = {
  SUNNY: 'Sunny', CLOUDY: 'Cloudy', RAINY: 'Rainy', WINDY: 'Windy', OTHER: 'Other',
};

function IconReports() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
}
function IconWeek() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
}
function IconMissing() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
}

interface Props {
  searchParams: Promise<{ project?: string; user?: string; from?: string; to?: string }>;
}

export default async function DprPage({ searchParams }: Props) {
  const sp = await searchParams;
  const projectFilter = sp.project || undefined;
  const userFilter = sp.user || undefined;

  const where: Record<string, unknown> = {};
  if (projectFilter) where.projectId = projectFilter;
  if (userFilter) where.userId = userFilter;
  if (sp.from || sp.to) {
    const range: { gte?: Date; lte?: Date } = {};
    if (sp.from) range.gte = new Date(`${sp.from}T00:00:00`);
    if (sp.to) range.lte = new Date(`${sp.to}T23:59:59.999`);
    where.reportDate = range;
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const startOfWeek = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);

  const [reports, totalMatching, totalReportsEver, projects, users, todaysReports, weekReports, activeSiteEngineers] =
    await Promise.all([
      prisma.dailyProgressReport.findMany({
        where,
        orderBy: { reportDate: 'desc' },
        take: RECORD_LIMIT,
        include: {
          project: { select: { id: true, name: true } },
          task: { select: { id: true, taskId: true, taskName: true } },
          photos: { select: { id: true } },
        },
      }),
      prisma.dailyProgressReport.count({ where }),
      prisma.dailyProgressReport.count(),
      prisma.project.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      prisma.userProfile.findMany({ select: { id: true, fullName: true }, orderBy: { fullName: 'asc' } }),
      // "Today"/"this week"/"missing today" are a global snapshot, deliberately
      // unaffected by the filter bar below — these are summary stat cards,
      // not a count of the filtered table.
      prisma.dailyProgressReport.findMany({
        where: { reportDate: { gte: startOfToday, lt: startOfTomorrow } },
        select: { userId: true },
      }),
      prisma.dailyProgressReport.count({ where: { reportDate: { gte: startOfWeek, lt: startOfTomorrow } } }),
      prisma.userProfile.findMany({
        where: { isActive: true, status: 'active', role: { in: ['site_engineer', 'senior_site_engineer'] } },
        select: { id: true, fullName: true },
      }),
    ]);

  const userMap = new Map(users.map((u) => [u.id, u.fullName]));

  const submittedTodayUserIds = new Set(todaysReports.map((r) => r.userId));
  const missingToday = activeSiteEngineers.filter((u) => !submittedTodayUserIds.has(u.id));

  const noDataAtAll = totalReportsEver === 0;
  const isCapped = totalMatching > RECORD_LIMIT;

  return (
    <div className="space-y-4">
      <DprRealtimeRefresher />

      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Daily Progress Reports</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Site progress reports captured by the mobile app.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatsCard label="Submitted Today" value={submittedTodayUserIds.size} icon={<IconReports />} description="Across all projects" />
        <StatsCard label="This Week" value={weekReports} icon={<IconWeek />} description="Last 7 days" />
        <StatsCard
          label="Missing Today"
          value={missingToday.length}
          icon={<IconMissing />}
          description={missingToday.length > 0 ? missingToday.map((u) => u.fullName).join(', ') : 'Everyone has submitted'}
        />
      </div>

      {noDataAtAll ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 flex flex-col items-center justify-center text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3 text-gray-300">
            <IconReports />
          </div>
          <p className="text-[13.5px] font-semibold text-gray-500 mb-1">No daily progress reports yet</p>
          <p className="text-[12.5px] text-gray-400 max-w-sm">
            Once site engineers start submitting reports from the mobile app, they&apos;ll appear here.
          </p>
        </div>
      ) : (
        <>
          <DprFilterBar projects={projects} users={users} />

          <div className="flex items-center justify-between px-1">
            <span className="text-[11.5px] text-gray-400">
              {reports.length} of {totalMatching} report{totalMatching === 1 ? '' : 's'}
            </span>
            {isCapped && (
              <span className="text-[11px] text-amber-600">
                Showing the most recent {RECORD_LIMIT} — narrow the filters to see older reports.
              </span>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '1px solid #f3f4f6' }}>
                  {['Date', 'Project', 'Task', 'Submitted By', 'Work Type', 'SFT', 'Workforce', 'Weather', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-[13px] text-gray-400">
                      No reports match these filters. <Link href="/dpr" className="underline hover:text-gray-700">Clear filters</Link>
                    </td>
                  </tr>
                ) : (
                  reports.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors cursor-pointer">
                      <td className="px-4 py-3">
                        <Link href={`/dpr/${r.id}`} className="block text-[12px] font-mono text-gray-700">
                          {formatDate(r.reportDate)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/dpr/${r.id}`} className="block text-[12px] text-gray-500">{r.project?.name ?? '—'}</Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/dpr/${r.id}`} className="block text-[12px] text-gray-500">
                          {r.task ? `${r.task.taskId} · ${r.task.taskName}` : '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/dpr/${r.id}`} className="block text-[12.5px] font-medium text-gray-900">
                          {userMap.get(r.userId) ?? 'Unknown user'}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/dpr/${r.id}`} className="block text-[12px] text-gray-700">{r.workType}</Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/dpr/${r.id}`} className="block text-[12px] text-gray-500 tabular-nums">
                          {r.sftCompleted != null ? Number(r.sftCompleted).toLocaleString() : '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/dpr/${r.id}`} className="block text-[12px] text-gray-500 tabular-nums">{r.workforceCount ?? '—'}</Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/dpr/${r.id}`} className="block text-[12px] text-gray-500">
                          {r.weatherCondition ? WEATHER_LABELS[r.weatherCondition] : '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/dpr/${r.id}`} className="text-[11px] font-semibold text-gray-400 hover:text-gray-700 whitespace-nowrap">
                          {r.photos.length > 0 ? `${r.photos.length} photo${r.photos.length === 1 ? '' : 's'} →` : 'View →'}
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
