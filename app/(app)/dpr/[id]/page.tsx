import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSignedDprPhotoUrl } from '@/lib/supabase/dpr-storage';
import { DprRealtimeRefresher } from '@/components/dpr/DprRealtimeRefresher';
import { formatDate, formatDateTime } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';

const WEATHER_LABELS: Record<string, string> = {
  SUNNY: 'Sunny', CLOUDY: 'Cloudy', RAINY: 'Rainy', WINDY: 'Windy', OTHER: 'Other',
};

const TEXT_FIELDS: { key: string; label: string }[] = [
  { key: 'workDescription', label: 'Description of work done' },
  { key: 'materialsUsed', label: 'Materials used/received' },
  { key: 'equipmentUsed', label: 'Equipment used' },
  { key: 'siteIssues', label: 'Site issues/delays' },
  { key: 'safetyObservations', label: 'Safety observations' },
  { key: 'visitorsOnSite', label: 'Visitors on site' },
  { key: 'remarks', label: 'Remarks' },
];

async function getReport(id: string) {
  return prisma.dailyProgressReport.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, name: true } },
      task: { select: { id: true, taskId: true, taskName: true } },
      photos: { orderBy: { createdAt: 'asc' } },
    },
  });
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DprDetailPage({ params }: Props) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) notFound();

  const userProfile = await prisma.userProfile.findUnique({ where: { id: report.userId }, select: { fullName: true } });

  const photosWithUrls = await Promise.all(
    report.photos.map(async (p) => ({
      ...p,
      url: await getSignedDprPhotoUrl(p.storagePath).catch(() => null),
    }))
  );

  return (
    <div className="space-y-4 max-w-3xl">
      <DprRealtimeRefresher />

      <div>
        <Link href="/dpr" className="text-[12.5px] font-medium text-muted-foreground hover:text-foreground transition-colors">
          ← Daily Progress Reports
        </Link>
      </div>

      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{formatDate(report.reportDate)}</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Submitted by {userProfile?.fullName ?? 'Unknown user'} · {formatDateTime(report.clientCapturedAt)}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 grid grid-cols-2 sm:grid-cols-4 gap-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div>
          <div className="text-[11px] font-medium text-muted-foreground mb-1">Project</div>
          <div className="text-[13px] font-medium text-gray-900">{report.project?.name ?? '—'}</div>
        </div>
        <div>
          <div className="text-[11px] font-medium text-muted-foreground mb-1">Task</div>
          <div className="text-[13px] font-medium text-gray-900">{report.task ? `${report.task.taskId} · ${report.task.taskName}` : '—'}</div>
        </div>
        <div>
          <div className="text-[11px] font-medium text-muted-foreground mb-1">Work Type</div>
          <div className="text-[13px] font-medium text-gray-900">{report.workType}</div>
        </div>
        <div>
          <div className="text-[11px] font-medium text-muted-foreground mb-1">Weather</div>
          <div className="text-[13px] font-medium text-gray-900">{report.weatherCondition ? WEATHER_LABELS[report.weatherCondition] : '—'}</div>
        </div>
        <div>
          <div className="text-[11px] font-medium text-muted-foreground mb-1">SFT Completed</div>
          <div className="text-[13px] font-medium text-gray-900">{report.sftCompleted != null ? Number(report.sftCompleted).toLocaleString() : '—'}</div>
        </div>
        <div>
          <div className="text-[11px] font-medium text-muted-foreground mb-1">Workforce Count</div>
          <div className="text-[13px] font-medium text-gray-900">{report.workforceCount ?? '—'}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {TEXT_FIELDS.map(({ key, label }) => {
          const value = (report as unknown as Record<string, string | null>)[key];
          if (!value) return null;
          return (
            <div key={key}>
              <div className="text-[11px] font-medium text-muted-foreground mb-1">{label}</div>
              <p className="text-[13px] text-gray-800 whitespace-pre-wrap leading-relaxed">{value}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div className="text-[11px] font-medium text-muted-foreground mb-3">
          Photos {report.photos.length > 0 && `(${report.photos.length})`}
        </div>
        {photosWithUrls.length === 0 ? (
          <p className="text-[12.5px] text-gray-400">No photos attached to this report.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photosWithUrls.map((p) => (
              <a
                key={p.id}
                href={p.url ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="block rounded-lg overflow-hidden border border-gray-200 aspect-square bg-gray-50"
              >
                {p.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.url} alt={p.caption ?? 'Site progress photo'} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[11px] text-gray-400">
                    Couldn&apos;t load photo
                  </div>
                )}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
