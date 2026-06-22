import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { isItemDone } from '@/lib/types/hvac';

export const dynamic = 'force-dynamic';

async function getProject(id: string) {
  try {
    return await prisma.project.findUnique({
      where: { id },
      include: {
        works: {
          orderBy: { createdAt: 'asc' },
          include: {
            tasks: {
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                taskId: true,
                taskName: true,
                status: true,
                createdAt: true,
                dependencyItems: {
                  select: {
                    id: true,
                    completion: { select: { status: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
  } catch {
    return null;
  }
}

type Task = {
  id: string;
  taskId: string;
  taskName: string;
  status: string;
  createdAt: Date;
  dependencyItems: { id: string; completion: { status: string } | null }[];
};

const STATUS_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  in_progress: { label: 'Active',   bg: '#111111', color: '#ffffff' },
  completed:   { label: 'Done',     bg: '#374151', color: '#ffffff' },
  blocked:     { label: 'Blocked',  bg: '#1f2937', color: '#ffffff' },
  ready:       { label: 'Ready',    bg: '#4b5563', color: '#ffffff' },
  draft:       { label: 'Draft',    bg: '#f3f4f6', color: '#6b7280' },
  on_hold:     { label: 'On Hold',  bg: '#374151', color: '#ffffff' },
};

/* ── SVG Bar Chart ───────────────────────────────────────── */
function BarChart({ works }: { works: { name: string; code: string; color: string; total: number; done: number }[] }) {
  if (works.length === 0) return (
    <div className="flex items-center justify-center h-[180px] text-[12px] text-gray-400">No works yet</div>
  );
  const max = Math.max(...works.map((w) => w.total), 1);
  const W = 540, H = 160, pad = 32, barW = Math.min(28, (W - pad * 2) / (works.length * 2.8));
  const groupW = (W - pad * 2) / works.length;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 36}`} style={{ overflow: 'visible' }}>
      {/* Y grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const y = pad + (H - pad) * (1 - f);
        return (
          <g key={f}>
            <line x1={pad} y1={y} x2={W - 8} y2={y} stroke="#f3f4f6" strokeWidth="1" />
            <text x={pad - 6} y={y + 4} textAnchor="end" fontSize="9" fill="#9ca3af">
              {Math.round(max * f)}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {works.map((w, i) => {
        const cx     = pad + groupW * i + groupW / 2;
        const totalH = max > 0 ? ((w.total) / max) * (H - pad) : 0;
        const doneH  = max > 0 ? ((w.done) / max) * (H - pad) : 0;
        const bw     = barW;
        return (
          <g key={w.code}>
            {/* Planned bar */}
            <rect
              x={cx - bw - 2} y={H - totalH} width={bw} height={totalH}
              rx="3" fill="#111111" opacity="0.85"
            />
            {/* Done bar */}
            <rect
              x={cx + 2} y={H - doneH} width={bw} height={doneH}
              rx="3" fill="#6b7280"
            />
            {/* Label */}
            <text x={cx} y={H + 16} textAnchor="middle" fontSize="9.5" fill="#6b7280">{w.code}</text>
          </g>
        );
      })}

      {/* Legend */}
      <g transform={`translate(${W - 140}, ${H + 26})`}>
        <rect x="0" y="0" width="8" height="8" rx="2" fill="#111111" opacity="0.85"/>
        <text x="11" y="7.5" fontSize="9" fill="#6b7280">Planned</text>
        <rect x="60" y="0" width="8" height="8" rx="2" fill="#6b7280"/>
        <text x="71" y="7.5" fontSize="9" fill="#6b7280">Done</text>
      </g>
    </svg>
  );
}

/* ── Arc gauge ───────────────────────────────────────────── */
function ArcGauge({ pct }: { pct: number }) {
  const r = 52, cx = 64, cy = 64;
  const arc = Math.PI * r;
  const segs = 24;
  const filled = Math.round((pct / 100) * segs);
  const points: { x1: number; y1: number; x2: number; y2: number; on: boolean }[] = [];
  for (let i = 0; i < segs; i++) {
    const a1 = Math.PI + (Math.PI / segs) * i + 0.04;
    const a2 = Math.PI + (Math.PI / segs) * (i + 1) - 0.04;
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
    points.push({ x1, y1, x2, y2, on: i < filled });
  }
  return (
    <svg width="128" height="72" viewBox="0 0 128 72">
      {points.map((p, i) => (
        <line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2}
          stroke={p.on ? '#111111' : '#e5e7eb'} strokeWidth="7" strokeLinecap="round" />
      ))}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="22" fontWeight="700" fill="#111111">{pct}%</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize="8.5" fill="#9ca3af">Completed Task</text>
    </svg>
  );
}

function fmt(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function ProjectDashboardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();

  const allTasks: (Task & { workCode: string; workColor: string; workName: string })[] = project.works.flatMap((w) =>
    w.tasks.map((t) => ({ ...t, workCode: w.code, workColor: w.color, workName: w.name }))
  );

  const allItems   = allTasks.flatMap((t) => t.dependencyItems);
  const doneDeps   = allItems.filter((i) => isItemDone(i.completion?.status as never)).length;
  const depPct     = allItems.length > 0 ? Math.round((doneDeps / allItems.length) * 100) : 0;

  const totalTasks = allTasks.length;
  const doneTasks  = allTasks.filter((t) => t.status === 'completed').length;
  const activeTasks  = allTasks.filter((t) => t.status === 'in_progress').length;
  const blockedTasks = allTasks.filter((t) => t.status === 'blocked').length;
  const completePct  = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const chartWorks = project.works.map((w) => ({
    name:  w.name,
    code:  w.code,
    color: w.color,
    total: w.tasks.length,
    done:  w.tasks.filter((t) => t.status === 'completed').length,
  }));

  const recentTasks = allTasks.slice(0, 10);

  return (
    <div className="space-y-5">

      {/* ── Breadcrumb + title ─────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <nav className="flex items-center gap-1.5 mb-1">
            <Link href="/projects" className="text-[11px] text-gray-400 hover:text-gray-700 transition-colors">Projects</Link>
            <span className="text-gray-300 text-[11px]">/</span>
            <span className="text-[11px] text-gray-400">{project.name}</span>
          </nav>
          <h1 className="text-[20px] font-bold tracking-tight text-gray-900">Dashboard</h1>
        </div>
        <Link
          href={`/projects/${project.id}/works/new`}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gray-900 text-white text-[12px] font-medium hover:bg-black transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          Add Work
        </Link>
      </div>

      {/* ── 4 Stat cards ──────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M9 21V11h6v10"/>
              </svg>
            ),
            value: project.works.length,
            label: 'Total Works',
            trend: null,
          },
          {
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
            ),
            value: doneTasks,
            label: 'Work Has Done',
            trend: totalTasks > 0 ? `${completePct}% complete` : null,
            trendPos: true,
          },
          {
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            ),
            value: blockedTasks,
            label: 'Blocked Tasks',
            trend: blockedTasks > 0 ? 'Needs attention' : 'All clear',
            trendPos: blockedTasks === 0,
          },
          {
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            ),
            value: `${depPct}%`,
            label: 'Deps Cleared',
            trend: `${doneDeps}/${allItems.length} items`,
            trendPos: depPct >= 50,
          },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="flex items-start justify-between mb-4">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
                {card.icon}
              </div>
            </div>
            <div className="text-[32px] font-bold tracking-tight text-gray-900 leading-none mb-1">{card.value}</div>
            <div className="text-[12.5px] text-gray-500 mb-1">{card.label}</div>
            {card.trend && (
              <div className="text-[11px] font-medium text-gray-400">
                {card.trend}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Charts row ────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Work Progress bar chart */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="flex items-start justify-between mb-1">
            <div>
              <h2 className="text-[14px] font-semibold text-gray-900">Work Progress</h2>
              <p className="text-[11.5px] text-gray-400 mt-0.5">Planned vs done tasks per work</p>
            </div>
            <span className="text-[11px] border border-gray-200 rounded-md px-2.5 py-1 text-gray-500">
              {project.works.length} work{project.works.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="mt-4">
            <BarChart works={chartWorks} />
          </div>
        </div>

        {/* Discipline / Work breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <h2 className="text-[14px] font-semibold text-gray-900 mb-1">Work Breakdown</h2>
          <p className="text-[11px] text-gray-400 mb-4">Tasks per work type</p>

          <div className="text-[28px] font-bold text-gray-900 leading-none">{totalTasks}</div>
          <div className="text-[11.5px] text-gray-400 mb-5">Total Tasks</div>

          {/* Per-work list */}
          <div className="space-y-3 mb-6">
            {project.works.slice(0, 5).map((w) => (
              <div key={w.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded bg-gray-900 flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0">
                    {w.code.slice(0, 1)}
                  </div>
                  <span className="text-[12px] text-gray-600 truncate max-w-[100px]">{w.name}</span>
                </div>
                <span className="text-[12.5px] font-semibold text-gray-800 tabular-nums">{w.tasks.length}</span>
              </div>
            ))}
            {project.works.length === 0 && (
              <p className="text-[11.5px] text-gray-400">No works yet.</p>
            )}
          </div>

          {/* Arc gauge */}
          <div className="flex flex-col items-center pt-4 border-t border-gray-100">
            <ArcGauge pct={completePct} />
          </div>
        </div>
      </div>

      {/* ── Task table ────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>

        {/* Table toolbar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <div className="flex items-center gap-2 w-56 bg-gray-50 border border-gray-200 rounded-lg px-3 h-8">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 flex-shrink-0">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <span className="text-[11.5px] text-gray-400">Search tasks…</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/projects/${project.id}/works/new`}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-gray-900 text-white text-[11.5px] font-medium hover:bg-black transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
              Add Work
            </Link>
          </div>
        </div>

        {/* Column headers */}
        <div className="grid items-center gap-4 px-5 py-2.5 bg-gray-50 border-b border-gray-100"
          style={{ gridTemplateColumns: '120px 1fr 1fr 90px 32px' }}>
          <span className="text-[10.5px] font-semibold text-gray-500 uppercase tracking-widest">Work ID</span>
          <span className="text-[10.5px] font-semibold text-gray-500 uppercase tracking-widest">Title</span>
          <span className="text-[10.5px] font-semibold text-gray-500 uppercase tracking-widest">Work</span>
          <span className="text-[10.5px] font-semibold text-gray-500 uppercase tracking-widest">Status</span>
          <span />
        </div>

        {/* Rows */}
        {recentTasks.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-[13px] text-gray-400 mb-3">No tasks yet.</p>
            <Link
              href={`/projects/${project.id}/works/new`}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-[12px] font-medium rounded-lg hover:bg-black transition-colors"
            >
              Add First Work
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentTasks.map((task) => {
              const status = STATUS_STYLE[task.status] ?? STATUS_STYLE.draft;
              return (
                <div
                  key={task.id}
                  className="grid items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors"
                  style={{ gridTemplateColumns: '120px 1fr 1fr 90px 32px' }}
                >
                  {/* Work ID */}
                  <span className="text-[12px] font-semibold text-gray-500 font-mono">
                    #{task.taskId}
                  </span>

                  {/* Title */}
                  <span className="text-[12.5px] text-gray-800 font-medium truncate">{task.taskName}</span>

                  {/* Work */}
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-gray-800 flex items-center justify-center text-white text-[7px] font-bold flex-shrink-0">
                      {task.workCode.slice(0, 1)}
                    </div>
                    <span className="text-[12px] text-gray-500 truncate">{task.workName}</span>
                  </div>

                  {/* Status */}
                  <span
                    className="text-[10.5px] font-semibold px-2 py-1 rounded-md text-center"
                    style={{ backgroundColor: status.bg, color: status.color }}
                  >
                    {status.label}
                  </span>

                  {/* Action */}
                  <button className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-gray-600 rounded hover:bg-gray-100 transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
