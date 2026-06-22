'use client';

/* ─────────────────────────────────────────────────────────────────
   Construction ERP Dashboard  ·  Black & White Enterprise Edition
───────────────────────────────────────────────────────────────── */

import { useState } from 'react';
import Link from 'next/link';

/* ── Static data ─────────────────────────────────────────────── */
const STATS = [
  { label: 'Total Tasks',         value: 108, sub: 'Across 16 categories', delta: null          },
  { label: 'Completed Tasks',     value: 43,  sub: '40% done rate',        delta: null          },
  { label: 'Tasks In Progress',   value: 31,  sub: 'Active work items',    delta: null          },
  { label: 'Delayed Tasks',       value: 12,  sub: 'Need attention',       delta: '+3 this week' },
];

const CATEGORY_PROGRESS = [
  { name: 'HVAC',           code: 'HVAC',      pct: 67, done: 4,  total: 6  },
  { name: 'Electrical',     code: 'ELEC',      pct: 38, done: 5,  total: 13 },
  { name: 'Plumbing',       code: 'PLUM',      pct: 45, done: 5,  total: 11 },
  { name: 'Civil Works',    code: 'CIVIL',     pct: 40, done: 4,  total: 10 },
  { name: 'Flooring',       code: 'FLOOR',     pct: 30, done: 3,  total: 10 },
  { name: 'False Ceiling',  code: 'F.CEIL',    pct: 43, done: 3,  total: 7  },
  { name: 'Carpentry',      code: 'CARPNTR',   pct: 57, done: 4,  total: 7  },
  { name: 'POP Works',      code: 'POP',       pct: 33, done: 1,  total: 3  },
  { name: 'Painting',       code: 'PAINT',     pct: 25, done: 2,  total: 8  },
  { name: 'Aluminium D&W',  code: 'ALU',       pct: 50, done: 1,  total: 2  },
  { name: 'Glass Works',    code: 'GLASS',     pct: 50, done: 1,  total: 2  },
  { name: 'Modular',        code: 'MOD',       pct: 60, done: 3,  total: 5  },
  { name: 'Fabrication',    code: 'FABRI',     pct: 33, done: 1,  total: 3  },
  { name: 'Waterproofing',  code: 'W.PROOF',   pct: 33, done: 1,  total: 3  },
  { name: 'Lighting',       code: 'LIGHT',     pct: 0,  done: 0,  total: 1  },
  { name: 'Landscape',      code: 'LSCAPE',    pct: 33, done: 1,  total: 3  },
];

const OVERALL_PCT = Math.round(
  CATEGORY_PROGRESS.reduce((s, c) => s + c.pct, 0) / CATEGORY_PROGRESS.length
);

const PROJECT_KPIS = [
  { label: 'Task Completion Rate',   pct: 40 },
  { label: 'DPR Submission Rate',    pct: 95 },
  { label: 'Attendance Rate',        pct: 80 },
  { label: 'Dependency Clearance Rate', pct: 49 },
];

const DEADLINES = [
  { task: 'HVAC Rough-In',            date: '25 Jun 2026', days: 3,  status: 'urgent'   },
  { task: 'Waterproofing Inspection', date: '28 Jun 2026', days: 6,  status: 'soon'     },
  { task: 'Electrical Conduit Work',  date: '05 Jul 2026', days: 13, status: 'upcoming' },
  { task: 'False Ceiling Frame',      date: '10 Jul 2026', days: 18, status: 'upcoming' },
  { task: 'Marble Flooring',          date: '15 Jul 2026', days: 23, status: 'upcoming' },
  { task: 'External Painting',        date: '20 Jul 2026', days: 28, status: 'upcoming' },
];

type ActivityIconKey = 'check' | 'upload' | 'clipboard' | 'dot' | 'download';
const ACTIVITY: { text: string; sub: string; time: string; icon: ActivityIconKey }[] = [
  { text: 'HVAC Task Completed',            sub: 'Kumar S · HVAC block',  time: '2h ago',     icon: 'check'     },
  { text: 'Plumbing Inspection Approved',   sub: 'Arjun K · Level 2',    time: '3h ago',     icon: 'check'     },
  { text: 'Site Engineer Uploaded Photos',  sub: '14 photos added',      time: '5h ago',     icon: 'upload'    },
  { text: 'DPR Submitted',                  sub: 'Manoj R · Block A',    time: '6h ago',     icon: 'clipboard' },
  { text: 'Electrical Conduit Marked',      sub: 'Priya R · Level 3',    time: 'Yesterday',  icon: 'dot'       },
  { text: 'Flooring Material Delivered',    sub: '42 boxes on site',      time: 'Yesterday',  icon: 'download'  },
  { text: 'Modular Measurements Taken',     sub: 'Ravi M · Kitchen area', time: '2 days ago', icon: 'dot'       },
];

const DEPS = { total: 47, completed: 23, blocked: 8, overdue: 4 };

const ATTENDANCE = { present: 16, absent: 4, late: 3, total: 20 };

const ATTENDANCE_BREAKDOWN = [
  { role: 'Site Engineers', present: 4, total: 5 },
  { role: 'Labourers',      present: 9, total: 10 },
  { role: 'Supervisors',    present: 3, total: 5  },
];

const DPR = { submitted: 8, pending: 4, photos: 23, docs: 7 };

const SITE_ACTIVITY = [
  { label: 'Tasks updated today',   value: 14 },
  { label: 'Tasks completed today', value: 6  },
  { label: 'Issues raised',         value: 3  },
  { label: 'New comments',          value: 22 },
];

const RECENT_PHOTOS = [
  { label: 'HVAC Unit',      code: 'HV' },
  { label: 'Ceiling Frame',  code: 'CF' },
  { label: 'Plumbing Pipe',  code: 'PP' },
  { label: 'Flooring Tile',  code: 'FT' },
];

/* ── Activity icon map ───────────────────────────────────────── */
function ActivityIcon({ type }: { type: ActivityIconKey }) {
  const icons: Record<ActivityIconKey, React.ReactNode> = {
    check:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    upload:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>,
    clipboard: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>,
    dot:       <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="4"/></svg>,
    download:  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  };
  return <>{icons[type]}</>;
}

/* ── Ring chart ──────────────────────────────────────────────── */
function RingChart({ pct, size = 140, strokeWidth = 12 }: { pct: number; size?: number; strokeWidth?: number }) {
  const r  = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F3F4F6" strokeWidth={strokeWidth} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#111111" strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.5s ease' }} />
    </svg>
  );
}

/* ── Mini sparkline ──────────────────────────────────────────── */
function Spark({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const w = 60; const h = 24; const step = w / (values.length - 1);
  const pts = values.map((v, i) => `${i * step},${h - (v / max) * h}`).join(' ');
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke="#111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Card shell ──────────────────────────────────────────────── */
function Card({ children, className = '', style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-2xl bg-white border border-gray-100 ${className}`}
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)', ...style }}>
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-50">
      <div>
        <h3 className="text-[13.5px] font-bold text-gray-900 tracking-tight">{title}</h3>
        {subtitle && <p className="text-[11.5px] text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ── Status pill ─────────────────────────────────────────────── */
function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    healthy:  { bg: '#F0FDF4', text: '#15803D', label: 'Healthy' },
    'at-risk':{ bg: '#FEFCE8', text: '#A16207', label: 'At Risk' },
    critical: { bg: '#FEF2F2', text: '#B91C1C', label: 'Critical'},
    urgent:   { bg: '#FEF2F2', text: '#B91C1C', label: ''        },
    soon:     { bg: '#FEFCE8', text: '#A16207', label: ''        },
    upcoming: { bg: '#F9FAFB', text: '#4B5563', label: ''        },
  };
  const m = map[status] ?? map.upcoming;
  return (
    <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: m.bg, color: m.text }}>
      {m.label || (status === 'urgent' ? 'Urgent' : status === 'soon' ? 'Soon' : 'Upcoming')}
    </span>
  );
}

/* ── Progress bar ────────────────────────────────────────────── */
function PBar({ pct, thin = false }: { pct: number; thin?: boolean }) {
  return (
    <div className={`w-full rounded-full bg-gray-100 overflow-hidden ${thin ? 'h-1' : 'h-1.5'}`}>
      <div className="h-full rounded-full bg-gray-900 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ── Link chip ───────────────────────────────────────────────── */
function Chip({ label, href }: { label: string; href: string }) {
  return (
    <Link href={href}>
      <span className="text-[11px] font-semibold text-gray-400 hover:text-gray-900 transition-colors">
        {label} →
      </span>
    </Link>
  );
}

/* ──────────────────────────────────────────────────────────────
   MAIN DASHBOARD
────────────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const [catFilter, setCatFilter] = useState<'all' | 'behind' | 'ahead'>('all');

  const visibleCats = CATEGORY_PROGRESS.filter((c) =>
    catFilter === 'all'    ? true :
    catFilter === 'behind' ? c.pct < 40 :
                             c.pct >= 40
  );

  return (
    <div className="space-y-4">

      {/* ── Page header ────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">ABC Villa Construction · Jun 22, 2026</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 text-[12.5px] font-semibold text-gray-600 hover:border-gray-400 hover:text-gray-900 transition-colors bg-white">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            This Week
          </button>
          <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12.5px] font-bold text-white bg-gray-900 hover:bg-gray-800 transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export
          </button>
        </div>
      </div>

      {/* ── Row 1: Stat cards ──────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3.5">
        {STATS.map((s, i) => (
          <Card key={s.label}>
            <div className="px-5 py-5">
              <p className="text-[11.5px] font-semibold text-gray-400 uppercase tracking-wider mb-3">{s.label}</p>
              <div className="flex items-end justify-between">
                <span className="text-[38px] font-black text-gray-900 leading-none tabular-nums">{s.value}</span>
                {i === 3 && <Spark values={[4, 6, 5, 8, 9, 10, 12]} />}
                {i === 0 && <Spark values={[90, 95, 100, 104, 107, 108]} />}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                <span className="text-[11.5px] text-gray-400">{s.sub}</span>
                {s.delta && (
                  <span className={`text-[10.5px] font-bold ${i === 3 ? 'text-red-500' : 'text-gray-400'}`}>
                    {s.delta}
                  </span>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Row 2: Completion chart + Project Health ─────── */}
      <div className="grid grid-cols-3 gap-3.5">

        {/* Completion chart (spans 2 cols) */}
        <Card className="col-span-2">
          <CardHeader
            title="Overall Project Completion"
            subtitle={`${CATEGORY_PROGRESS.length} work categories tracked`}
            action={
              <div className="flex items-center gap-1 rounded-lg border border-gray-100 p-0.5">
                {(['all','behind','ahead'] as const).map((f) => (
                  <button key={f} onClick={() => setCatFilter(f)}
                    className="px-3 py-1.5 rounded-md text-[11px] font-semibold capitalize transition-all"
                    style={{ background: catFilter === f ? '#111' : 'transparent', color: catFilter === f ? '#fff' : '#9CA3AF' }}>
                    {f === 'all' ? 'All' : f === 'behind' ? 'Behind' : 'Ahead'}
                  </button>
                ))}
              </div>
            }
          />
          <div className="p-5 flex gap-8">
            {/* Ring */}
            <div className="flex-shrink-0 flex flex-col items-center justify-center gap-2">
              <div className="relative">
                <RingChart pct={OVERALL_PCT} size={140} strokeWidth={12} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[30px] font-black text-gray-900 leading-none tabular-nums">{OVERALL_PCT}%</span>
                  <span className="text-[10.5px] text-gray-400 font-semibold mt-1">Overall</span>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <div className="text-center">
                  <div className="text-[15px] font-black text-gray-900 tabular-nums">
                    {CATEGORY_PROGRESS.reduce((s, c) => s + c.done, 0)}
                  </div>
                  <div className="text-[10px] text-gray-400 font-semibold">Done</div>
                </div>
                <div className="w-px h-6 bg-gray-100" />
                <div className="text-center">
                  <div className="text-[15px] font-black text-gray-900 tabular-nums">
                    {CATEGORY_PROGRESS.reduce((s, c) => s + c.total - c.done, 0)}
                  </div>
                  <div className="text-[10px] text-gray-400 font-semibold">Left</div>
                </div>
              </div>
            </div>

            {/* Category progress bars */}
            <div className="flex-1 grid grid-cols-2 gap-x-8 gap-y-3 content-start">
              {visibleCats.map((c) => (
                <div key={c.code}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11.5px] font-semibold text-gray-700">{c.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10.5px] text-gray-400">{c.done}/{c.total}</span>
                      <span className="text-[11px] font-bold text-gray-900 tabular-nums w-8 text-right">{c.pct}%</span>
                    </div>
                  </div>
                  <PBar pct={c.pct} thin />
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Project Health */}
        <Card>
          <CardHeader title="Project Health" subtitle="ABC Villa Construction" action={<Chip label="Details" href="/project-health" />} />
          <div className="p-5">
            {/* Overall health badge */}
            <div className="flex items-center gap-3 p-4 rounded-xl mb-4" style={{ background: '#F0FDF4' }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#16A34A' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div>
                <div className="text-[15px] font-black text-green-900">Healthy</div>
                <div className="text-[11.5px] text-green-700">Health score: 84 / 100</div>
              </div>
            </div>
            {/* KPI breakdown */}
            <div className="space-y-3">
              {PROJECT_KPIS.map((k) => (
                <div key={k.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] text-gray-600">{k.label}</span>
                    <span className="text-[12px] font-bold text-gray-900 tabular-nums">{k.pct}%</span>
                  </div>
                  <PBar pct={k.pct} thin />
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* ── Row 3: Deadlines + Activity ─────────────────────── */}
      <div className="grid grid-cols-2 gap-3.5">

        {/* Upcoming Deadlines */}
        <Card>
          <CardHeader title="Upcoming Deadlines" subtitle="Next 3 weeks" action={<Chip label="View calendar" href="/calendar" />} />
          <div className="divide-y divide-gray-50">
            {DEADLINES.map((d, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/60 transition-colors">
                {/* Days badge */}
                <div className="w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
                  style={{ background: d.days <= 5 ? '#FEF2F2' : d.days <= 10 ? '#FEFCE8' : '#F9FAFB' }}>
                  <span className="text-[14px] font-black leading-none tabular-nums"
                    style={{ color: d.days <= 5 ? '#B91C1C' : d.days <= 10 ? '#A16207' : '#374151' }}>
                    {d.days}
                  </span>
                  <span className="text-[8.5px] font-bold"
                    style={{ color: d.days <= 5 ? '#DC2626' : d.days <= 10 ? '#CA8A04' : '#9CA3AF' }}>
                    days
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-gray-900 truncate">{d.task}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">ABC Villa · {d.date}</p>
                </div>
                <StatusPill status={d.status} />
              </div>
            ))}
          </div>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader title="Recent Activity" subtitle="Latest site updates" action={<Chip label="View all" href="/dpr" />} />
          <div className="divide-y divide-gray-50">
            {ACTIVITY.map((a, i) => (
              <div key={i} className="flex items-start gap-3.5 px-5 py-3.5 hover:bg-gray-50/60 transition-colors">
                {/* Icon dot */}
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 bg-gray-100 text-gray-500">
                  <ActivityIcon type={a.icon} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-semibold text-gray-900">{a.text}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{a.sub}</p>
                </div>
                <span className="text-[10.5px] text-gray-300 font-medium flex-shrink-0 mt-0.5">{a.time}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Row 4: Dependency + Attendance ──────────────────── */}
      <div className="grid grid-cols-2 gap-3.5">

        {/* Dependency Health */}
        <Card>
          <CardHeader title="Dependency Health" subtitle="Cross-team blockers" action={<Chip label="Manage" href="/hvac" />} />
          <div className="p-5">
            {/* Big 4 stat tiles */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                { label: 'Total',     value: DEPS.total,     bg: '#F9FAFB' },
                { label: 'Completed', value: DEPS.completed, bg: '#F0FDF4' },
                { label: 'Blocked',   value: DEPS.blocked,   bg: '#FEF2F2' },
                { label: 'Overdue',   value: DEPS.overdue,   bg: '#FEFCE8' },
              ].map((d) => (
                <div key={d.label} className="rounded-xl p-3 text-center" style={{ background: d.bg }}>
                  <div className="text-[24px] font-black text-gray-900 tabular-nums">{d.value}</div>
                  <div className="text-[10.5px] text-gray-400 font-semibold mt-0.5">{d.label}</div>
                </div>
              ))}
            </div>

            {/* Completion bar */}
            <div className="mb-3">
              <div className="flex justify-between text-[11.5px] mb-1.5">
                <span className="font-semibold text-gray-700">Completion rate</span>
                <span className="font-bold text-gray-900">{Math.round((DEPS.completed / DEPS.total) * 100)}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-gray-900"
                  style={{ width: `${Math.round((DEPS.completed / DEPS.total) * 100)}%` }} />
              </div>
            </div>

            {/* Breakdown rows */}
            {[
              { label: 'Architect approvals',  pending: 3, color: '#6B7280' },
              { label: 'Client sign-offs',      pending: 2, color: '#6B7280' },
              { label: 'Vendor deliveries',     pending: 3, color: '#B91C1C' },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between py-2 border-t border-gray-50">
                <span className="text-[12px] text-gray-600">{r.label}</span>
                <span className="text-[12px] font-bold px-2 py-0.5 rounded-lg bg-gray-100" style={{ color: r.color }}>
                  {r.pending} pending
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Attendance Summary */}
        <Card>
          <CardHeader title="Attendance Summary" subtitle="Today · Jun 22, 2026" action={<Chip label="Full report" href="/attendance" />} />
          <div className="p-5">
            {/* Big 3 tiles */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: 'Present', value: ATTENDANCE.present, bg: '#F0FDF4', text: '#15803D' },
                { label: 'Absent',  value: ATTENDANCE.absent,  bg: '#FEF2F2', text: '#B91C1C' },
                { label: 'Late',    value: ATTENDANCE.late,    bg: '#FEFCE8', text: '#A16207' },
              ].map((a) => (
                <div key={a.label} className="rounded-xl p-3 text-center" style={{ background: a.bg }}>
                  <div className="text-[28px] font-black tabular-nums" style={{ color: a.text }}>{a.value}</div>
                  <div className="text-[10.5px] font-semibold text-gray-400 mt-0.5">{a.label}</div>
                </div>
              ))}
            </div>

            {/* Attendance rate bar */}
            <div className="mb-4">
              <div className="flex justify-between text-[11.5px] mb-1.5">
                <span className="font-semibold text-gray-700">Attendance rate</span>
                <span className="font-bold text-gray-900">{Math.round((ATTENDANCE.present / ATTENDANCE.total) * 100)}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-gray-900"
                  style={{ width: `${Math.round((ATTENDANCE.present / ATTENDANCE.total) * 100)}%` }} />
              </div>
            </div>

            {/* Role breakdown */}
            {ATTENDANCE_BREAKDOWN.map((b) => (
              <div key={b.role} className="flex items-center gap-3 py-2 border-t border-gray-50">
                <span className="text-[12px] text-gray-600 flex-1">{b.role}</span>
                <div className="flex items-center gap-2 w-28">
                  <div className="flex-1 h-1 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-gray-800"
                      style={{ width: `${Math.round((b.present / b.total) * 100)}%` }} />
                  </div>
                  <span className="text-[11px] font-semibold text-gray-500 tabular-nums whitespace-nowrap">{b.present}/{b.total}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Row 5: DPR + Site Activity ──────────────────────── */}
      <div className="grid grid-cols-2 gap-3.5">

        {/* DPR Summary */}
        <Card>
          <CardHeader title="Daily Progress Reports" subtitle="Today's submission status" action={<Chip label="Open DPR" href="/dpr" />} />
          <div className="p-5">
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: 'Submitted Today', value: DPR.submitted, bg: '#F0FDF4', text: '#15803D',
                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> },
                { label: 'Pending Reports', value: DPR.pending,   bg: '#FEF2F2', text: '#B91C1C',
                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
                { label: 'Photos Uploaded', value: DPR.photos,    bg: '#F9FAFB', text: '#374151',
                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> },
                { label: 'Docs Uploaded',   value: DPR.docs,      bg: '#F9FAFB', text: '#374151',
                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg> },
              ].map((d) => (
                <div key={d.label} className="rounded-xl p-4 flex items-center gap-3" style={{ background: d.bg }}>
                  <div style={{ color: d.text }}>{d.icon}</div>
                  <div>
                    <div className="text-[22px] font-black leading-none tabular-nums" style={{ color: d.text }}>{d.value}</div>
                    <div className="text-[10.5px] text-gray-400 font-semibold mt-0.5">{d.label}</div>
                  </div>
                </div>
              ))}
            </div>
            {/* Submission rate */}
            <div className="pt-3 border-t border-gray-50">
              <div className="flex justify-between text-[11.5px] mb-1.5">
                <span className="font-semibold text-gray-700">Submission rate today</span>
                <span className="font-bold text-gray-900">{Math.round((DPR.submitted / (DPR.submitted + DPR.pending)) * 100)}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-gray-900"
                  style={{ width: `${Math.round((DPR.submitted / (DPR.submitted + DPR.pending)) * 100)}%` }} />
              </div>
            </div>
          </div>
        </Card>

        {/* Site Activity */}
        <Card>
          <CardHeader title="Site Activity Summary" subtitle="Last 24 hours" action={<Chip label="View works" href="/works" />} />
          <div className="p-5">
            {/* Activity metrics */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {SITE_ACTIVITY.map((a) => (
                <div key={a.label} className="rounded-xl p-4 bg-gray-50">
                  <div className="text-[26px] font-black text-gray-900 tabular-nums">{a.value}</div>
                  <div className="text-[11px] text-gray-400 font-semibold mt-0.5">{a.label}</div>
                </div>
              ))}
            </div>

            {/* Recent photo uploads */}
            <div className="pt-3 border-t border-gray-50">
              <p className="text-[11.5px] font-bold text-gray-400 uppercase tracking-wider mb-3">Recent Photo Uploads</p>
              <div className="flex items-center gap-2">
                {RECENT_PHOTOS.map((ph) => (
                  <Link href="/photos" key={ph.label}>
                    <div className="w-14 h-14 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center hover:border-gray-400 transition-colors cursor-pointer">
                      <span className="text-[11px] font-black text-gray-400">{ph.code}</span>
                    </div>
                  </Link>
                ))}
                <Link href="/photos">
                  <div className="w-14 h-14 rounded-xl bg-gray-50 border border-dashed border-gray-200 flex flex-col items-center justify-center hover:border-gray-400 transition-colors cursor-pointer">
                    <span className="text-[16px] text-gray-300">+</span>
                    <span className="text-[9px] text-gray-300 font-semibold">19 more</span>
                  </div>
                </Link>
              </div>
            </div>

            {/* Quick links */}
            <div className="flex items-center gap-2 pt-4 mt-1 border-t border-gray-50">
              {[
                { label: 'Site Photos',    href: '/photos'    },
                { label: 'Documents',      href: '/documents' },
                { label: 'Reports',        href: '/reports'   },
              ].map((l) => (
                <Link key={l.href} href={l.href}>
                  <span className="text-[11.5px] font-semibold text-gray-400 hover:text-gray-900 transition-colors px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100">
                    {l.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </Card>
      </div>

    </div>
  );
}
