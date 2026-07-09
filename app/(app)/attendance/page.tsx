import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { AttendanceFilterBar } from '@/components/attendance/AttendanceFilterBar';
import { MarkReviewedButton } from '@/components/attendance/MarkReviewedButton';
import { formatDateTime, formatDistanceMeters } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';

const RECORD_LIMIT = 500;

function IconCheckIn() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>;
}
function IconActive() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>;
}
function IconFlag() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
}
function IconDone() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>;
}

interface Props {
  searchParams: Promise<{ project?: string; user?: string; from?: string; to?: string; flagged?: string }>;
}

export default async function AttendancePage({ searchParams }: Props) {
  const sp = await searchParams;
  const projectFilter = sp.project || undefined;
  const userFilter = sp.user || undefined;
  const flaggedOnly = sp.flagged === '1';

  const where: Record<string, unknown> = {};
  if (projectFilter) where.projectId = projectFilter;
  if (userFilter) where.userId = userFilter;
  if (flaggedOnly) where.isFlagged = true;
  if (sp.from || sp.to) {
    const range: { gte?: Date; lte?: Date } = {};
    if (sp.from) range.gte = new Date(`${sp.from}T00:00:00`);
    if (sp.to) range.lte = new Date(`${sp.to}T23:59:59.999`);
    where.clientCapturedAt = range;
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  const [records, totalMatching, totalRecordsEver, projects, users, todaysRecords, flaggedUnreviewed, flaggedReviewed] =
    await Promise.all([
      prisma.attendanceRecord.findMany({
        where,
        orderBy: { clientCapturedAt: 'desc' },
        take: RECORD_LIMIT,
        include: { project: { select: { id: true, name: true, siteLatitude: true, siteLongitude: true } } },
      }),
      prisma.attendanceRecord.count({ where }),
      prisma.attendanceRecord.count(),
      prisma.project.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      prisma.userProfile.findMany({ select: { id: true, fullName: true }, orderBy: { fullName: 'asc' } }),
      // "Today" and the two flagged counts are a global snapshot, deliberately
      // unaffected by the filter bar below — these are summary stat cards,
      // not a count of the filtered table.
      prisma.attendanceRecord.findMany({
        where: { clientCapturedAt: { gte: startOfToday, lt: startOfTomorrow } },
        orderBy: { clientCapturedAt: 'asc' },
        select: { userId: true, type: true },
      }),
      prisma.attendanceRecord.count({ where: { isFlagged: true, reviewedAt: null } }),
      prisma.attendanceRecord.count({ where: { isFlagged: true, reviewedAt: { not: null } } }),
    ]);

  const userMap = new Map(users.map((u) => [u.id, u.fullName]));

  const todaysCheckIns = todaysRecords.filter((r) => r.type === 'CHECK_IN').length;
  // "Currently checked in" = each user's most recent record today is a
  // CHECK_IN with no later CHECK_OUT. Records are fetched ordered oldest ->
  // newest, so the last write per user in this map is their latest state.
  const lastTypeByUser = new Map<string, 'CHECK_IN' | 'CHECK_OUT'>();
  for (const r of todaysRecords) lastTypeByUser.set(r.userId, r.type);
  const currentlyCheckedIn = [...lastTypeByUser.values()].filter((t) => t === 'CHECK_IN').length;

  const noDataAtAll = totalRecordsEver === 0;
  const isCapped = totalMatching > RECORD_LIMIT;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Attendance</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Check-in/out records captured by the mobile app.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatsCard label="Check-Ins Today" value={todaysCheckIns} icon={<IconCheckIn />} description="Across all projects" />
        <StatsCard label="Currently Checked In" value={currentlyCheckedIn} icon={<IconActive />} description="No check-out yet today" />
        <StatsCard label="Flagged — Unreviewed" value={flaggedUnreviewed} icon={<IconFlag />} description="Needs a look" />
        <StatsCard label="Flagged — Reviewed" value={flaggedReviewed} icon={<IconDone />} description="Already handled" />
      </div>

      {noDataAtAll ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 flex flex-col items-center justify-center text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
          </div>
          <p className="text-[13.5px] font-semibold text-gray-500 mb-1">No attendance records yet</p>
          <p className="text-[12.5px] text-gray-400 max-w-sm">
            Once site engineers start checking in from the mobile app, records will appear here.
          </p>
        </div>
      ) : (
        <>
          <AttendanceFilterBar projects={projects} users={users} />

          <div className="flex items-center justify-between px-1">
            <span className="text-[11.5px] text-gray-400">
              {records.length} of {totalMatching} record{totalMatching === 1 ? '' : 's'}
            </span>
            {isCapped && (
              <span className="text-[11px] text-amber-600">
                Showing the most recent {RECORD_LIMIT} — narrow the filters to see older records.
              </span>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '1px solid #f3f4f6' }}>
                  {['User', 'Project', 'Type', 'Captured', 'Distance', 'Flags', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-[13px] text-gray-400">
                      No records match these filters. <Link href="/attendance" className="underline hover:text-gray-700">Clear filters</Link>
                    </td>
                  </tr>
                ) : (
                  records.map((r) => {
                    const distanceLabel = !r.project
                      ? 'No project'
                      : r.project.siteLatitude == null || r.project.siteLongitude == null
                      ? 'No site location set'
                      : formatDistanceMeters(r.distanceFromSiteMeters != null ? Number(r.distanceFromSiteMeters) : null);

                    return (
                      <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-[12.5px] font-medium text-gray-900">
                            {userMap.get(r.userId) ?? 'Unknown user'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[12px] text-gray-500">{r.project?.name ?? '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap"
                            style={
                              r.type === 'CHECK_IN'
                                ? { background: '#F0FDF4', color: '#166534', borderColor: '#BBF7D0' }
                                : { background: '#EFF6FF', color: '#1E40AF', borderColor: '#BFDBFE' }
                            }
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: r.type === 'CHECK_IN' ? '#22C55E' : '#3B82F6' }} />
                            {r.type === 'CHECK_IN' ? 'Check In' : 'Check Out'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[12px] font-mono text-gray-700">{formatDateTime(r.clientCapturedAt)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[12px] text-gray-500 tabular-nums">{distanceLabel}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {r.isFlagged && (
                              <span
                                title={r.flagReason ?? 'Flagged'}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold border cursor-help whitespace-nowrap"
                                style={{ background: '#FFF7ED', color: '#9A3412', borderColor: '#FED7AA' }}
                              >
                                ⚠ Flagged
                              </span>
                            )}
                            {r.mockLocationSuspected && (
                              <span
                                title="Device reported a mock/spoofed location provider — stronger signal than distance alone"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold border cursor-help whitespace-nowrap"
                                style={{ background: '#FEF2F2', color: '#991B1B', borderColor: '#FECACA' }}
                              >
                                ⛔ Mock Location
                              </span>
                            )}
                            {!r.isFlagged && !r.mockLocationSuspected && (
                              <span className="text-[11px] text-gray-300">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {r.isFlagged && !r.reviewedAt && <MarkReviewedButton recordId={r.id} />}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
