import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Replaces the old hardcoded mockup (fixed fixture arrays, no real data).
// Reports are per-project (see [projectId]/report/page.tsx) — this page is
// just the picker, one real query, no fixtures.
export default async function ReportsPage() {
  const projects = await prisma.project.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      reportSentAt: true,
      _count: { select: { works: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Reports</h1>
        <p className="text-[13.5px] text-gray-500 mt-1">Pick a project to view or send its client progress report.</p>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-gray-200 rounded-lg">
          <p className="text-[13px] font-semibold text-gray-300">No projects yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}/report`}
              className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
            >
              <div>
                <p className="text-[13.5px] font-semibold text-gray-900">{p.name}</p>
                <p className="text-[11.5px] text-gray-400 mt-0.5">{p._count.works} work{p._count.works === 1 ? '' : 's'}</p>
              </div>
              <span className="text-[11.5px] text-gray-400">
                {p.reportSentAt
                  ? `Sent ${p.reportSentAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                  : 'Not sent yet'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
