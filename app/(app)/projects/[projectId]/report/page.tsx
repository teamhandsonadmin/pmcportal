import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProjectReportData, getProjectClients, type ReportDateRange } from '@/lib/data/report';
import { ClientProgressReport } from '@/components/reports/ClientProgressReport';
import { SendToClientButton } from '@/components/reports/SendToClientButton';
import { ReportDateRangePicker } from '@/components/reports/ReportDateRangePicker';

export const dynamic = 'force-dynamic';

// YYYY-MM-DD from a <input type="date"> — anchored to UTC explicitly (not
// the server process's local timezone) since plannedStartDate is a @db.Date
// column, which Prisma reads back as a UTC-midnight Date. Parsing `to` as
// LOCAL midnight instead would silently exclude that entire last day on any
// server whose timezone is ahead of UTC (e.g. IST): local midnight is then
// still the previous UTC day, so a task planned exactly on the end date
// fails the `lte` bound. `to` extends through the end of that calendar day
// so it stays inclusive regardless.
function parseDateParam(value: string | undefined, endOfDay: boolean): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default async function ProjectReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { projectId } = await params;
  const { from: fromParam, to: toParam } = await searchParams;

  const from = parseDateParam(fromParam, false);
  const to = parseDateParam(toParam, true);
  const range: ReportDateRange | undefined = (from && to && from <= to) ? { from, to } : undefined;

  const [data, clients] = await Promise.all([
    getProjectReportData(projectId, range),
    getProjectClients(projectId),
  ]);
  if (!data) notFound();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Link href={`/projects/${projectId}`} className="text-[12.5px] text-gray-500 hover:text-gray-900 transition-colors">
          ← Back to project
        </Link>
        <SendToClientButton
          projectId={projectId}
          projectName={data.projectName}
          hasClient={clients.length > 0}
          reportSentAt={data.reportSentAt}
        />
      </div>

      <ReportDateRangePicker
        projectId={projectId}
        initialFrom={range ? fromParam ?? null : null}
        initialTo={range ? toParam ?? null : null}
      />

      <ClientProgressReport data={data} />
    </div>
  );
}
