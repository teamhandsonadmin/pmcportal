'use client';

import { useState } from 'react';

/* ─── Data ───────────────────────────────────────────────────── */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

const PROGRESS_TREND  = [52, 58, 63, 68, 72, 78];
const HEALTH_TREND    = [76, 78, 80, 82, 80, 84];
const ISSUES_RAISED   = [8,  6,  9,  5,  7,  2];
const ISSUES_RESOLVED = [5,  7,  8,  6,  6,  5];
const ATTENDANCE      = [88, 90, 92, 91, 93, 94];

const STAGES = [
  { label: 'Site Preparation',         done: true  },
  { label: 'Civil Works',              done: true  },
  { label: 'Electrical Rough-in',      done: true  },
  { label: 'HVAC Installation',        done: false, active: true },
  { label: 'Testing & Commissioning',  done: false },
  { label: 'Final Handover',           done: false },
];

const PHOTOS = [
  { title: 'Living Room HVAC Installation', date: '14 Jun 2025', room: 'Living Room' },
  { title: 'Outdoor Unit Placement',        date: '12 Jun 2025', room: 'Terrace' },
  { title: 'Electrical Routing Progress',   date: '10 Jun 2025', room: 'Corridor' },
  { title: 'Final Ceiling Preparation',     date: '08 Jun 2025', room: 'Bedroom 1' },
];

/* ─── SVG Line Chart ─────────────────────────────────────────── */
function LineChart({ data, labels, color = '#111111', yMin, yMax, h = 90, fill = true }: {
  data: number[]; labels: string[]; color?: string;
  yMin?: number; yMax?: number; h?: number; fill?: boolean;
}) {
  const W = 320, H = h, pad = { t: 10, r: 10, b: 22, l: 32 };
  const minV = yMin ?? Math.min(...data) - 3;
  const maxV = yMax ?? Math.max(...data) + 3;
  const xStep = (W - pad.l - pad.r) / (data.length - 1);
  const pts = data.map((v, i) => ({
    x: pad.l + i * xStep,
    y: pad.t + (H - pad.t - pad.b) * (1 - (v - minV) / (maxV - minV)),
    v,
  }));
  const line = pts.map((p) => `${p.x},${p.y}`).join(' ');
  const area = `${pts[0].x},${H - pad.b} ${line} ${pts[pts.length - 1].x},${H - pad.b}`;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      {[0, 0.5, 1].map((f) => {
        const y = pad.t + (H - pad.t - pad.b) * (1 - f);
        return (
          <g key={f}>
            <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="#f3f4f6" strokeWidth="1" />
            <text x={pad.l - 5} y={y + 3.5} textAnchor="end" fontSize="8" fill="#9ca3af">
              {Math.round(minV + (maxV - minV) * f)}
            </text>
          </g>
        );
      })}
      {fill && <polygon points={area} fill={color} opacity="0.07" />}
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke={color} strokeWidth="2" />
      ))}
      {labels.map((l, i) => (
        <text key={l} x={pad.l + i * xStep} y={H - 5} textAnchor="middle" fontSize="8" fill="#9ca3af">{l}</text>
      ))}
    </svg>
  );
}

/* ─── Dual Line Chart (issues: raised vs resolved) ───────────── */
function DualLineChart({ a, b, labels, h = 90 }: {
  a: number[]; b: number[]; labels: string[]; h?: number;
}) {
  const W = 320, H = h, pad = { t: 10, r: 10, b: 22, l: 28 };
  const all = [...a, ...b];
  const minV = Math.min(...all) - 1;
  const maxV = Math.max(...all) + 1;
  const xStep = (W - pad.l - pad.r) / (a.length - 1);
  const pts = (arr: number[]) => arr.map((v, i) => ({
    x: pad.l + i * xStep,
    y: pad.t + (H - pad.t - pad.b) * (1 - (v - minV) / (maxV - minV)),
  }));
  const lineA = pts(a);
  const lineB = pts(b);
  const pA = lineA.map((p) => `${p.x},${p.y}`).join(' ');
  const pB = lineB.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      {[0, 0.5, 1].map((f) => {
        const y = pad.t + (H - pad.t - pad.b) * (1 - f);
        return <line key={f} x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="#f3f4f6" strokeWidth="1" />;
      })}
      <polyline points={pA} fill="none" stroke="#111111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={pB} fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 2" />
      {lineA.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="#fff" stroke="#111111" strokeWidth="2" />)}
      {lineB.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="#fff" stroke="#9ca3af" strokeWidth="2" />)}
      {labels.map((l, i) => (
        <text key={l} x={pad.l + i * xStep} y={H - 5} textAnchor="middle" fontSize="8" fill="#9ca3af">{l}</text>
      ))}
    </svg>
  );
}

/* ─── KPI Card ───────────────────────────────────────────────── */
function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div className="text-[28px] font-extrabold text-gray-900 leading-none">{value}</div>
      <div className="text-[12.5px] font-medium text-gray-600 mt-1.5">{label}</div>
      {sub && <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

/* ─── Section heading ────────────────────────────────────────── */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="w-1 h-4 rounded-full bg-gray-900" />
      <h2 className="text-[12px] font-bold uppercase tracking-[0.12em] text-gray-900">{children}</h2>
    </div>
  );
}

/* ─── Stat row ───────────────────────────────────────────────── */
function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-[12.5px] text-gray-500">{label}</span>
      <span className="text-[13px] font-bold text-gray-900">{value}</span>
    </div>
  );
}

/* ─── Action Button ──────────────────────────────────────────── */
function ActionBtn({ icon, label, dark }: { icon: React.ReactNode; label: string; dark?: boolean }) {
  return (
    <button
      className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[12.5px] font-medium transition-colors"
      style={{
        backgroundColor: dark ? '#111111' : '#f9fafb',
        color:           dark ? '#ffffff' : '#374151',
        border:          dark ? '1px solid #111111' : '1px solid #e5e7eb',
      }}
      onMouseEnter={(e) => {
        if (!dark) (e.currentTarget as HTMLElement).style.backgroundColor = '#f3f4f6';
      }}
      onMouseLeave={(e) => {
        if (!dark) (e.currentTarget as HTMLElement).style.backgroundColor = '#f9fafb';
      }}
    >
      {icon}
      {label}
    </button>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function ReportsPage() {
  const [view, setView] = useState<'client' | 'internal'>('client');

  return (
    <div className="space-y-6">

      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Reports</h1>
          <p className="text-[13.5px] text-gray-500 mt-1">Project progress, client reporting, and performance insights.</p>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
          {(['client', 'internal'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-4 py-2 rounded-lg text-[12px] font-semibold transition-all capitalize"
              style={{
                backgroundColor: view === v ? '#111111' : 'transparent',
                color:           view === v ? '#ffffff' : '#6b7280',
              }}
            >
              {v === 'client' ? 'Client View' : 'Internal View'}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Active Projects"           value="18"  sub="Currently in progress" />
        <KpiCard label="Completed Projects"        value="6"   sub="This year" />
        <KpiCard label="Project Health Score"      value="84%" sub="ABC Villa Construction" />
        <KpiCard label="Reports Generated"         value="42"  sub="This month" />
      </div>

      {/* ── Project Progress Summary ──────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <SectionTitle>Project Progress Summary</SectionTitle>
            <h3 className="text-[16px] font-bold text-gray-900 -mt-1">ABC Villa Construction</h3>
            <p className="text-[12px] text-gray-400 mt-0.5">Current Stage: HVAC Installation</p>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-gray-400 uppercase tracking-wider mb-1">Health Score</div>
            <div className="text-[28px] font-extrabold text-gray-900 leading-none">84<span className="text-[14px] font-semibold text-gray-400">/100</span></div>
            <div className="text-[11px] text-gray-500 mt-1">Expected: 12 Aug 2026</div>
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12.5px] font-semibold text-gray-700">Overall Progress</span>
            <span className="text-[14px] font-extrabold text-gray-900">78%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gray-900 rounded-full transition-all duration-700" style={{ width: '78%' }} />
          </div>
        </div>

        {/* Stage timeline */}
        <div className="flex items-center gap-0 overflow-x-auto pb-1">
          {STAGES.map((stage, i) => (
            <div key={stage.label} className="flex items-center min-w-0">
              <div className="flex flex-col items-center">
                {/* Node */}
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border-2"
                  style={{
                    backgroundColor: stage.done ? '#111111' : stage.active ? '#374151' : '#f3f4f6',
                    borderColor:     stage.done ? '#111111' : stage.active ? '#374151' : '#d1d5db',
                  }}
                >
                  {stage.done ? (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : stage.active ? (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-gray-300" />
                  )}
                </div>
                {/* Label */}
                <span
                  className="text-[10.5px] mt-1.5 text-center whitespace-nowrap max-w-[80px] leading-tight"
                  style={{
                    fontWeight: stage.done || stage.active ? '600' : '400',
                    color: stage.done ? '#111111' : stage.active ? '#374151' : '#9ca3af',
                  }}
                >
                  {stage.label}
                </span>
              </div>
              {/* Connector */}
              {i < STAGES.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 mb-4 flex-shrink-0 min-w-[24px]"
                  style={{ backgroundColor: stage.done ? '#374151' : '#e5e7eb' }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Weekly + Monthly Reports ──────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        {/* Weekly */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <SectionTitle>Weekly Report Summary</SectionTitle>
          <div className="text-[11px] text-gray-400 -mt-2 mb-4">Week of 16 – 22 Jun 2025</div>
          <StatRow label="Tasks Completed"   value="12" />
          <StatRow label="Tasks In Progress" value="6" />
          <StatRow label="Issues Raised"     value="2" />
          <StatRow label="Issues Resolved"   value="5" />
          <div className="flex items-center justify-between py-2.5 mt-1 bg-gray-50 rounded-xl px-3">
            <span className="text-[12.5px] text-gray-500">Progress Increased</span>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-gray-400 line-through">72%</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round">
                <path d="M5 12h14M13 6l6 6-6 6"/>
              </svg>
              <span className="text-[13px] font-extrabold text-gray-900">78%</span>
            </div>
          </div>
        </div>

        {/* Monthly */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <SectionTitle>Monthly Report Summary</SectionTitle>
          <div className="text-[11px] text-gray-400 -mt-2 mb-4">June 2025</div>
          <StatRow label="Total Tasks Completed"  value="48" />
          <StatRow label="Total Issues Resolved"  value="18" />
          <StatRow label="Avg Team Attendance"    value="94%" />
          <StatRow label="DPR Submission Rate"     value="92%" />
          <div className="flex items-center gap-2 mt-3 p-3 bg-gray-900 rounded-xl">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <span className="text-[12px] text-white font-medium">Month targets met across all KPIs</span>
          </div>
        </div>
      </div>

      {/* ── Charts ────────────────────────────────────────── */}
      <div>
        <SectionTitle>Performance Charts</SectionTitle>
        <div className="grid grid-cols-2 gap-4">

          <div className="bg-white rounded-2xl border border-gray-200 p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[13px] font-bold text-gray-900">Project Progress Trend</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Overall completion % per month</p>
              </div>
              <span className="text-[13px] font-extrabold text-gray-900 tabular-nums">78%</span>
            </div>
            <LineChart data={PROGRESS_TREND} labels={MONTHS} yMin={40} yMax={100} h={90} />
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[13px] font-bold text-gray-900">Monthly Health Score Trend</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Project health score out of 100</p>
              </div>
              <span className="text-[13px] font-extrabold text-gray-900 tabular-nums">84</span>
            </div>
            <LineChart data={HEALTH_TREND} labels={MONTHS} yMin={70} yMax={100} h={90} />
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-[13px] font-bold text-gray-900">Issue Resolution Trend</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Raised vs resolved per month</p>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 bg-gray-900 rounded" />
                  <span className="text-gray-500">Raised</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 bg-gray-400 rounded" style={{ borderStyle: 'dashed', height: '1px', borderTop: '2px dashed #9ca3af' }} />
                  <span className="text-gray-500">Resolved</span>
                </div>
              </div>
            </div>
            <DualLineChart a={ISSUES_RAISED} b={ISSUES_RESOLVED} labels={MONTHS} h={90} />
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[13px] font-bold text-gray-900">Attendance Trend</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Team attendance % per month</p>
              </div>
              <span className="text-[13px] font-extrabold text-gray-900 tabular-nums">94%</span>
            </div>
            <LineChart data={ATTENDANCE} labels={MONTHS} yMin={80} yMax={100} h={90} />
          </div>

        </div>
      </div>

      {/* ── Recent Site Photos ─────────────────────────────── */}
      <div>
        <SectionTitle>Recent Site Photos</SectionTitle>
        <div className="grid grid-cols-4 gap-4">
          {PHOTOS.map((photo, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden group cursor-pointer" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              {/* Placeholder image block */}
              <div
                className="h-36 flex flex-col items-center justify-center gap-2 transition-colors"
                style={{ backgroundColor: i % 2 === 0 ? '#f3f4f6' : '#f9fafb' }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                <span className="text-[10px] text-gray-400 font-medium">{photo.room}</span>
              </div>
              <div className="px-3 py-2.5">
                <div className="text-[12px] font-semibold text-gray-800 leading-snug">{photo.title}</div>
                <div className="text-[10.5px] text-gray-400 mt-0.5">{photo.date}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Report Actions ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <SectionTitle>Report Actions</SectionTitle>
        <div className="flex items-center flex-wrap gap-3">
          <ActionBtn dark label="Download PDF" icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          } />
          <ActionBtn label="Export Excel" icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          } />
          <ActionBtn label="Email Client" icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/>
            </svg>
          } />
          <ActionBtn label="Share Report Link" icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          } />

          <div className="flex-1" />

          {/* View badge */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200">
            <div className="w-1.5 h-1.5 rounded-full bg-gray-900" />
            <span className="text-[12px] text-gray-600 font-medium">
              {view === 'client' ? 'Client View — sensitive data hidden' : 'Internal View — full data visible'}
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
