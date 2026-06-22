'use client';

import { useState } from 'react';

/* ─── Types ─────────────────────────────────────────────────── */
interface Engineer {
  rank: number; name: string; initials: string; score: number;
  attendance: number; dpr: number; tasks: number;
  status: 'Excellent' | 'Good' | 'Average' | 'Needs Attention';
  projects: string[]; joinDate: string; issues: number;
}

/* ─── Dummy Data ─────────────────────────────────────────────── */
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

const ENGINEERS: Engineer[] = [
  { rank: 1, name: 'Kumar S',   initials: 'KS', score: 942, attendance: 98, dpr: 100, tasks: 148, status: 'Excellent',       projects: ['Tower A', 'Villa Project'], joinDate: 'Mar 2022', issues: 3 },
  { rank: 2, name: 'Arjun K',   initials: 'AK', score: 925, attendance: 96, dpr: 98,  tasks: 136, status: 'Excellent',       projects: ['Tower B', 'Mall Fit-out'],  joinDate: 'Jun 2022', issues: 2 },
  { rank: 3, name: 'Manoj R',   initials: 'MR', score: 901, attendance: 94, dpr: 95,  tasks: 129, status: 'Good',            projects: ['Villa Project'],            joinDate: 'Sep 2021', issues: 5 },
  { rank: 4, name: 'Karthik V', initials: 'KV', score: 845, attendance: 88, dpr: 90,  tasks: 115, status: 'Average',         projects: ['Tower A'],                  joinDate: 'Jan 2023', issues: 7 },
  { rank: 5, name: 'Praveen M', initials: 'PM', score: 790, attendance: 82, dpr: 80,  tasks: 92,  status: 'Needs Attention', projects: ['Mall Fit-out'],             joinDate: 'Apr 2023', issues: 12 },
];

const ENG_SCORE_TREND  = [[820, 850, 870, 900, 925, 942], [800, 830, 860, 890, 910, 925], [860, 870, 875, 885, 895, 901], [790, 800, 820, 835, 840, 845], [750, 760, 775, 780, 785, 790]];
const ENG_ATTEND_TREND = [[94, 96, 97, 98, 97, 98], [92, 93, 95, 96, 95, 96], [90, 92, 93, 94, 94, 94], [84, 86, 87, 88, 88, 88], [78, 80, 81, 82, 82, 82]];
const ENG_TASKS_TREND  = [[95, 110, 122, 133, 141, 148], [88, 100, 110, 120, 128, 136], [82, 95, 105, 115, 122, 129], [75, 88, 96, 104, 110, 115], [60, 70, 78, 83, 88, 92]];

const ENG_ACTIVITIES = [
  'DPR submitted for Villa Project',
  'Completed Electrical Routing Task',
  'Raised Material Dependency Issue',
  'Uploaded 12 Site Photos',
];

/* ─── Badge styles ───────────────────────────────────────────── */
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  'Excellent':       { bg: '#111111', color: '#ffffff' },
  'Good':            { bg: '#374151', color: '#ffffff' },
  'Average':         { bg: '#e5e7eb', color: '#374151' },
  'Needs Attention': { bg: '#1f2937', color: '#ffffff' },
};

/* ─── SVG Line Chart ─────────────────────────────────────────── */
function LineChart({ data, labels, color = '#111111', yMin, yMax, h = 80 }: {
  data: number[]; labels: string[]; color?: string; yMin?: number; yMax?: number; h?: number;
}) {
  const W = 280, H = h, pad = { t: 8, r: 8, b: 20, l: 28 };
  const minV = yMin ?? Math.min(...data) - 2;
  const maxV = yMax ?? Math.max(...data) + 2;
  const xStep = (W - pad.l - pad.r) / (data.length - 1);
  const pts = data.map((v, i) => {
    const x = pad.l + i * xStep;
    const y = pad.t + (H - pad.t - pad.b) * (1 - (v - minV) / (maxV - minV));
    return { x, y, v };
  });
  const polyline = pts.map((p) => `${p.x},${p.y}`).join(' ');
  const area = `${pts[0].x},${H - pad.b} ${polyline} ${pts[pts.length - 1].x},${H - pad.b}`;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      {[0, 0.5, 1].map((f) => {
        const y = pad.t + (H - pad.t - pad.b) * (1 - f);
        const val = Math.round(minV + (maxV - minV) * f);
        return (
          <g key={f}>
            <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="#f3f4f6" strokeWidth="1" />
            <text x={pad.l - 4} y={y + 3.5} textAnchor="end" fontSize="8.5" fill="#9ca3af">{val}</text>
          </g>
        );
      })}
      <polygon points={area} fill={color} opacity="0.06" />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#ffffff" stroke={color} strokeWidth="1.8" />
      ))}
      {labels.map((l, i) => (
        <text key={l} x={pad.l + i * xStep} y={H - 4} textAnchor="middle" fontSize="8.5" fill="#9ca3af">{l}</text>
      ))}
    </svg>
  );
}

/* ─── Stat card ──────────────────────────────────────────────── */
function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div className="text-[28px] font-extrabold text-gray-900 leading-none">{value}</div>
      <div className="text-[12px] text-gray-500 mt-1.5">{label}</div>
      {sub && <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

/* ─── Rank badge ─────────────────────────────────────────────── */
function RankBadge({ rank }: { rank: number }) {
  const styles = [
    { bg: '#111111', color: '#ffffff', text: '1st' },
    { bg: '#374151', color: '#ffffff', text: '2nd' },
    { bg: '#4b5563', color: '#ffffff', text: '3rd' },
  ];
  const s = styles[rank - 1] ?? { bg: '#f3f4f6', color: '#6b7280', text: `${rank}th` };
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[11px] font-bold flex-shrink-0" style={{ backgroundColor: s.bg, color: s.color }}>
      {s.text}
    </span>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function ScoreCardsPage() {
  const [selectedEngineer, setSelectedEngineer] = useState<Engineer>(ENGINEERS[0]);
  const engIdx = ENGINEERS.indexOf(selectedEngineer);

  return (
    <div className="space-y-8">

      {/* ── Page header ─────────────────────────────────────── */}
      <div>
        <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Score Cards</h1>
        <p className="text-[13.5px] text-gray-500 mt-1">Site engineer performance rankings, scores, and trend analysis.</p>
      </div>

      {/* ── Top summary cards ─────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Engineers',   value: '24',      sub: 'Active this month' },
          { label: 'Average Score',     value: '892',     sub: 'Out of 1000' },
          { label: 'Top Performer',     value: 'Kumar S', sub: 'Score: 942' },
          { label: 'Engineers at Risk', value: '3',       sub: 'Score below 800' },
        ].map((c) => <StatCard key={c.label} {...c} />)}
      </div>

      {/* ── Leaderboard + Detail ─────────────────────────────── */}
      <div className="grid grid-cols-12 gap-4">

        {/* Leaderboard */}
        <div className="col-span-7 bg-white rounded-2xl border border-gray-200 overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h3 className="text-[13.5px] font-bold text-gray-900">Performance Leaderboard</h3>
              <p className="text-[11.5px] text-gray-400 mt-0.5">Ranked by composite score — Jun 2025</p>
            </div>
            <span className="text-[11px] text-gray-500 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg">5 of 24 engineers</span>
          </div>

          <div className="grid px-5 py-2.5 bg-gray-50 border-b border-gray-100 text-[10px] font-bold uppercase tracking-widest text-gray-400"
            style={{ gridTemplateColumns: '36px 1fr 80px 70px 70px 80px 90px' }}>
            <span>#</span>
            <span>Engineer</span>
            <span className="text-right">Score</span>
            <span className="text-right">Attend.</span>
            <span className="text-right">DPR</span>
            <span className="text-right">Tasks</span>
            <span className="text-center">Status</span>
          </div>

          {ENGINEERS.map((eng) => {
            const isSelected = eng.rank === selectedEngineer.rank;
            const ss = STATUS_STYLE[eng.status];
            return (
              <div
                key={eng.rank}
                onClick={() => setSelectedEngineer(eng)}
                className="grid items-center px-5 py-4 border-b border-gray-50 last:border-0 cursor-pointer transition-colors"
                style={{
                  gridTemplateColumns: '36px 1fr 80px 70px 70px 80px 90px',
                  backgroundColor: isSelected ? '#f9fafb' : 'transparent',
                }}
                onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = '#fafafa'; }}
                onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                <RankBadge rank={eng.rank} />

                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                    {eng.initials}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-gray-900 truncate">{eng.name}</div>
                    <div className="text-[10.5px] text-gray-400 truncate">{eng.projects[0]}</div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[14px] font-extrabold text-gray-900 tabular-nums">{eng.score}</span>
                </div>
                <div className="text-right text-[12.5px] font-semibold text-gray-700 tabular-nums">{eng.attendance}%</div>
                <div className="text-right text-[12.5px] font-semibold text-gray-700 tabular-nums">{eng.dpr}%</div>
                <div className="text-right text-[12.5px] font-semibold text-gray-700 tabular-nums">{eng.tasks}</div>

                <div className="flex justify-center">
                  <span className="text-[10.5px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: ss.bg, color: ss.color }}>
                    {eng.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Engineer detail panel */}
        <div className="col-span-5 space-y-4">

          {/* Profile card */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div className="bg-gray-900 px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white text-[14px] font-bold flex-shrink-0">
                  {selectedEngineer.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-bold text-white">{selectedEngineer.name}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">Site Engineer · Rank #{selectedEngineer.rank}</div>
                </div>
                <div className="text-right">
                  <div className="text-[26px] font-extrabold text-white leading-none">{selectedEngineer.score}</div>
                  <div className="text-[9.5px] text-gray-400 mt-0.5 uppercase tracking-wider">Score</div>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10.5px] text-gray-400">Performance</span>
                  <span className="text-[10.5px] text-gray-400">{Math.round(selectedEngineer.score / 10)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${selectedEngineer.score / 10}%` }} />
                </div>
              </div>
            </div>

            <div className="px-5 py-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Attendance',    value: `${selectedEngineer.attendance}%` },
                  { label: 'DPR Rate',      value: `${selectedEngineer.dpr}%` },
                  { label: 'Tasks Done',    value: selectedEngineer.tasks },
                  { label: 'Issues Raised', value: selectedEngineer.issues },
                  { label: 'Joined',        value: selectedEngineer.joinDate },
                  { label: 'Status',        value: selectedEngineer.status },
                ].map((row) => (
                  <div key={row.label} className="bg-gray-50 rounded-lg px-3 py-2.5">
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider">{row.label}</div>
                    <div className="text-[13px] font-bold text-gray-900 mt-0.5">{row.value}</div>
                  </div>
                ))}
              </div>

              <div className="mt-3">
                <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1.5">Assigned Projects</div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedEngineer.projects.map((p) => (
                    <span key={p} className="text-[11px] px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 font-medium">{p}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Recent activities */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h3 className="text-[12px] font-bold text-gray-900 uppercase tracking-wider mb-3">Recent Activity</h3>
            <div className="space-y-2.5">
              {ENG_ACTIVITIES.map((a, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <span className="text-[12px] text-gray-700 leading-snug">{a}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Engineer trend charts ─────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { title: 'Score Trend',          data: ENG_SCORE_TREND[engIdx],  yMin: 700, yMax: 1000, unit: 'pts' },
          { title: 'Attendance Trend',      data: ENG_ATTEND_TREND[engIdx], yMin: 70,  yMax: 100,  unit: '%'   },
          { title: 'Tasks Completed Trend', data: ENG_TASKS_TREND[engIdx],  yMin: 0,   yMax: 160,  unit: ''    },
        ].map((chart) => (
          <div key={chart.title} className="bg-white rounded-2xl border border-gray-200 p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[12.5px] font-bold text-gray-900">{chart.title}</h3>
              <span className="text-[11px] text-gray-500 tabular-nums font-mono">
                {chart.data[chart.data.length - 1]}{chart.unit}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mb-4">{selectedEngineer.name} · Last 6 months</p>
            <LineChart data={chart.data} labels={MONTHS_SHORT} yMin={chart.yMin} yMax={chart.yMax} h={80} />
          </div>
        ))}
      </div>

    </div>
  );
}
