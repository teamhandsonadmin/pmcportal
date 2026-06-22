'use client';

const HEALTH_METRICS = [
  { label: 'Task Completion',       pct: 90 },
  { label: 'Dependency Clearance',  pct: 85 },
  { label: 'Attendance Rate', pct: 95 },
  { label: 'Issue Resolution',      pct: 78 },
  { label: 'DPR Submission',        pct: 92 },
  { label: 'Schedule Adherence',    pct: 81 },
];

const RISK_ALERTS = [
  { level: 'high',   text: 'Electrical Works delayed by 4 days' },
  { level: 'medium', text: 'Material dependency pending for HVAC stage' },
  { level: 'low',    text: 'Contractor attendance below target' },
];

const MONTHLY_HEALTH = [72, 76, 79, 81, 80, 84];
const MONTHS_SHORT   = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

const RISK_STYLE: Record<string, { bar: string; bg: string; border: string }> = {
  high:   { bar: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  medium: { bar: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  low:    { bar: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
};

function healthColor(score: number) {
  if (score >= 80) return { stroke: '#16a34a', text: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', label: 'Healthy' };
  if (score >= 60) return { stroke: '#d97706', text: '#b45309', bg: '#fffbeb', border: '#fde68a', label: 'Needs Attention' };
  return { stroke: '#dc2626', text: '#b91c1c', bg: '#fef2f2', border: '#fecaca', label: 'At Risk' };
}

function CircularGauge({ score, max = 100 }: { score: number; max?: number }) {
  const r = 60, cx = 72, cy = 72;
  const circ = 2 * Math.PI * r;
  const filled = circ * (score / max);
  const gap = circ - filled;
  const c = healthColor(score);
  return (
    <svg width="144" height="144" viewBox="0 0 144 144">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={c.stroke} strokeWidth="10"
        strokeDasharray={`${filled} ${gap}`} strokeDashoffset={circ * 0.25} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s ease' }} />
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize="28" fontWeight="800" fill={c.text}>{score}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="10" fill="#9ca3af">out of {max}</text>
      <text x={cx} y={cy + 24} textAnchor="middle" fontSize="9.5" fontWeight="600" fill={c.text}>HEALTH SCORE</text>
    </svg>
  );
}

function LineChart({ data, labels, yMin, yMax, h = 80, color = '#111111' }: {
  data: number[]; labels: string[]; yMin?: number; yMax?: number; h?: number; color?: string;
}) {
  const W = 280, H = h, pad = { t: 8, r: 8, b: 20, l: 28 };
  const minV = yMin ?? Math.min(...data) - 2;
  const maxV = yMax ?? Math.max(...data) + 2;
  const xStep = (W - pad.l - pad.r) / (data.length - 1);
  const pts = data.map((v, i) => ({
    x: pad.l + i * xStep,
    y: pad.t + (H - pad.t - pad.b) * (1 - (v - minV) / (maxV - minV)),
    v,
  }));
  const polyline = pts.map((p) => `${p.x},${p.y}`).join(' ');
  const area = `${pts[0].x},${H - pad.b} ${polyline} ${pts[pts.length - 1].x},${H - pad.b}`;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      {[0, 0.5, 1].map((f) => {
        const y = pad.t + (H - pad.t - pad.b) * (1 - f);
        return (
          <g key={f}>
            <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="#f3f4f6" strokeWidth="1" />
            <text x={pad.l - 4} y={y + 3.5} textAnchor="end" fontSize="8.5" fill="#9ca3af">
              {Math.round(minV + (maxV - minV) * f)}
            </text>
          </g>
        );
      })}
      <polygon points={area} fill={color} opacity="0.08" />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="#ffffff" stroke={color} strokeWidth="1.8" />)}
      {labels.map((l, i) => (
        <text key={l} x={pad.l + i * xStep} y={H - 4} textAnchor="middle" fontSize="8.5" fill="#9ca3af">{l}</text>
      ))}
    </svg>
  );
}

function metricColor(pct: number) {
  if (pct >= 85) return '#16a34a';
  if (pct >= 70) return '#d97706';
  return '#dc2626';
}

function ProgressBar({ pct, label }: { pct: number; label: string }) {
  const color = metricColor(pct);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12.5px] text-gray-600">{label}</span>
        <span className="text-[12.5px] font-bold tabular-nums" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div className="text-[28px] font-extrabold text-gray-900 leading-none">{value}</div>
      <div className="text-[12px] text-gray-500 mt-1.5">{label}</div>
      {sub && <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function ProjectHealthPage() {
  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Project Health</h1>
        <p className="text-[13.5px] text-gray-500 mt-1">Real-time performance monitoring and KPI health for ABC Villa Construction.</p>
      </div>

      <section className="space-y-5">

        {/* ── Top row: score + summary cards ───────────────── */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-4 bg-white rounded-2xl border border-gray-200 p-6 flex flex-col items-center justify-center gap-3" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <CircularGauge score={84} />
            <div className="text-center">
              {(() => { const c = healthColor(84); return (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold mb-1 border"
                  style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.stroke }} />
                  {c.label}
                </div>
              ); })()}
              <p className="text-[11.5px] text-gray-400 mt-1">Based on 6 weighted KPIs across this month</p>
            </div>
          </div>

          <div className="col-span-8 grid grid-cols-3 gap-4">
            {[
              { label: 'Total Tasks',    value: '180', sub: 'Across all works' },
              { label: 'Completed',      value: '145', sub: '80.5% done rate' },
              { label: 'Delayed Tasks',  value: '8',   sub: 'Past due date' },
              { label: 'Blocked Tasks',  value: '3',   sub: 'Awaiting deps' },
              { label: 'Open Issues',    value: '5',   sub: 'Active snags' },
              { label: 'DPR Submission Rate', value: '92%', sub: 'This month' },
            ].map((c) => <StatCard key={c.label} {...c} />)}
          </div>
        </div>

        {/* ── Health breakdown + Risk alerts ───────────────── */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-7 bg-white rounded-2xl border border-gray-200 p-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-[13.5px] font-bold text-gray-900">Health Breakdown</h3>
                <p className="text-[11.5px] text-gray-400 mt-0.5">Performance across key construction KPIs</p>
              </div>
              <span className="text-[11px] font-mono text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">Jun 2025</span>
            </div>
            <div className="space-y-4">
              {HEALTH_METRICS.map((m) => <ProgressBar key={m.label} label={m.label} pct={m.pct} />)}
            </div>
          </div>

          <div className="col-span-5 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[13.5px] font-bold text-gray-900">Risk Alerts</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-900 text-white">3 Active</span>
              </div>
              <div className="space-y-3">
                {RISK_ALERTS.map((a, i) => {
                  const s = RISK_STYLE[a.level];
                  return (
                    <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl border" style={{ backgroundColor: s.bg, borderColor: s.border }}>
                      <div className="w-1 h-full min-h-[32px] rounded-full flex-shrink-0" style={{ backgroundColor: s.bar }} />
                      <div className="flex-1">
                        <p className="text-[12.5px] text-gray-800 font-medium leading-snug">{a.text}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5 capitalize">{a.level} priority</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-gray-900 rounded-2xl p-5 text-white">
              <p className="text-[10.5px] font-bold uppercase tracking-widest text-gray-400 mb-3">This Month vs Last</p>
              {[
                { label: 'Tasks Closed',  curr: 32, prev: 27 },
                { label: 'Issues Raised', curr: 5,  prev: 9  },
                { label: 'DPR Filed',     curr: 28, prev: 24 },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-2 border-b border-white/10 last:border-0">
                  <span className="text-[12px] text-gray-300">{row.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold">{row.curr}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/10 text-gray-300">
                      {row.curr >= row.prev ? `+${row.curr - row.prev}` : `${row.curr - row.prev}`} vs {row.prev}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Monthly health trend ──────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-[13.5px] font-bold text-gray-900">Monthly Project Health Trend</h3>
              <p className="text-[11.5px] text-gray-400 mt-0.5">Overall health score across the last 6 months</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-500">Score range: 72 – 84</span>
              <div className="flex items-center gap-1.5 ml-3">
                <div className="w-3 h-0.5 bg-gray-900 rounded" />
                <span className="text-[11px] text-gray-500">Health Score</span>
              </div>
            </div>
          </div>
          <div className="flex gap-4 mb-5">
            {MONTHLY_HEALTH.map((v, i) => (
              <div key={i} className="flex-1 text-center">
                <div className="text-[18px] font-bold text-gray-900">{v}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{MONTHS_SHORT[i]}</div>
              </div>
            ))}
          </div>
          <div className="px-1">
            <LineChart data={MONTHLY_HEALTH} labels={MONTHS_SHORT} yMin={65} yMax={100} h={100} color="#16a34a" />
          </div>
        </div>

      </section>
    </div>
  );
}
