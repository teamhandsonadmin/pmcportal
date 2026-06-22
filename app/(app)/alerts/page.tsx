'use client';

import { useState } from 'react';

/* ─── Types & Data ───────────────────────────────────────────── */
type Priority = 'critical' | 'high' | 'medium' | 'low';
type AlertStatus = 'open' | 'pending' | 'under_review' | 'resolved';
type AlertType = 'delay' | 'dpr' | 'blocked' | 'workforce' | 'contractor' | 'health';

interface AlertRow {
  id: string; type: AlertType; project: string;
  priority: Priority; status: AlertStatus;
  fields: { label: string; value: string }[];
  actions: string[];
}

const ALERTS: AlertRow[] = [
  {
    id: 'ALT-001', type: 'delay', project: 'ABC Villa', priority: 'critical', status: 'open',
    fields: [
      { label: 'Task',        value: 'HVAC Duct Installation' },
      { label: 'Assigned To', value: 'Kumar S' },
      { label: 'Delay',       value: '4 Days' },
    ],
    actions: ['View Task', 'Escalate', 'Contact Engineer', 'Mark Reviewed'],
  },
  {
    id: 'ALT-002', type: 'dpr', project: 'ABC Villa', priority: 'critical', status: 'open',
    fields: [
      { label: 'Engineer',      value: 'Arjun K' },
      { label: 'Missing Since', value: '2 Days' },
      { label: 'Zone',          value: 'Block B' },
    ],
    actions: ['Contact Engineer', 'Send Reminder', 'Mark Reviewed'],
  },
  {
    id: 'ALT-003', type: 'blocked', project: 'ABC Villa', priority: 'high', status: 'pending',
    fields: [
      { label: 'Task',          value: 'Electrical Conduit Work' },
      { label: 'Reason',        value: 'Consultant Approval Pending' },
      { label: 'Blocked Since', value: '3 Days' },
    ],
    actions: ['View Dependency', 'Escalate', 'Contact Responsible'],
  },
  {
    id: 'ALT-004', type: 'workforce', project: 'ABC Villa', priority: 'high', status: 'open',
    fields: [
      { label: 'Team',     value: 'Team B' },
      { label: 'Expected', value: '15 Workers' },
      { label: 'Present',  value: '9 Workers (−6 Short)' },
    ],
    actions: ['View Project', 'Contact Contractor', 'Escalate'],
  },
  {
    id: 'ALT-005', type: 'contractor', project: 'ABC Villa', priority: 'high', status: 'under_review',
    fields: [
      { label: 'Contractor',      value: 'ABC Electrical Contractors' },
      { label: 'Current Score',   value: '690 / 1000' },
      { label: 'Affected Tasks',  value: '12 Tasks' },
    ],
    actions: ['Review Contractor', 'Escalate', 'Contact Contractor'],
  },
  {
    id: 'ALT-006', type: 'health', project: 'ABC Villa', priority: 'critical', status: 'open',
    fields: [
      { label: 'Health Score',      value: '61 / 100' },
      { label: 'Delayed Tasks',     value: '8 Tasks' },
      { label: 'Blocked Deps',      value: '3 Blockers' },
    ],
    actions: ['Open Project', 'Review Health', 'Escalate'],
  },
];

const ACTIVITY = [
  { time: '09:15 AM', text: 'HVAC Duct Installation delayed by 4 days',          type: 'critical' as Priority },
  { time: '09:45 AM', text: 'Workforce shortage reported by Team B',              type: 'high'     as Priority },
  { time: '10:30 AM', text: 'Project Health dropped from 78 to 61 — Swathi Villa', type: 'critical' as Priority },
  { time: '11:00 AM', text: 'DPR missing — Arjun K (Block C)',                   type: 'critical' as Priority },
  { time: '11:45 AM', text: 'Consultant approval pending — Electrical Works',    type: 'high'     as Priority },
  { time: '12:20 PM', text: 'ALT-005 moved to Under Review',                     type: 'medium'   as Priority },
];

const TYPE_META: Record<AlertType, { label: string; color: string }> = {
  delay:      { label: 'Project Delay',        color: '#991B1B' },
  dpr:        { label: 'Missing DPR',          color: '#991B1B' },
  blocked:    { label: 'Dependency Blocker',   color: '#9A3412' },
  workforce:  { label: 'Workforce Issue',      color: '#854D0E' },
  contractor: { label: 'Contractor Risk',      color: '#9A3412' },
  health:     { label: 'Project Health Risk',  color: '#991B1B' },
};

const PRI: Record<Priority, { bg: string; text: string; border: string; dot: string; label: string }> = {
  critical: { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA', dot: '#DC2626', label: 'Critical' },
  high:     { bg: '#FFF7ED', text: '#9A3412', border: '#FED7AA', dot: '#EA580C', label: 'High' },
  medium:   { bg: '#FEFCE8', text: '#854D0E', border: '#FEF08A', dot: '#CA8A04', label: 'Medium' },
  low:      { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0', dot: '#16A34A', label: 'Low' },
};

const STATUS_STYLE: Record<AlertStatus, { bg: string; text: string; label: string }> = {
  open:         { bg: '#FEF2F2', text: '#991B1B', label: 'Open' },
  pending:      { bg: '#FEFCE8', text: '#854D0E', label: 'Pending' },
  under_review: { bg: '#EFF6FF', text: '#1D4ED8', label: 'Under Review' },
  resolved:     { bg: '#F0FDF4', text: '#166534', label: 'Resolved' },
};

type CatFilter = 'all' | AlertType;

/* ─── Helpers ────────────────────────────────────────────────── */
function PriBadge({ p }: { p: Priority }) {
  const c = PRI[p];
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap"
      style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.dot }} />
      {c.label}
    </span>
  );
}

function StatusBadge({ s }: { s: AlertStatus }) {
  const c = STATUS_STYLE[s];
  return (
    <span className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold"
      style={{ backgroundColor: c.bg, color: c.text }}>
      {c.label}
    </span>
  );
}

function ActionBtn({ label, primary }: { label: string; primary?: boolean }) {
  return (
    <button className="px-2.5 py-1 rounded-lg text-[11.5px] font-medium transition-colors border"
      style={{
        backgroundColor: primary ? '#111111' : '#f9fafb',
        color:           primary ? '#ffffff' : '#374151',
        borderColor:     primary ? '#111111' : '#e5e7eb',
      }}>
      {label}
    </button>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function AlertsCenterPage() {
  const [catFilter, setCatFilter] = useState<CatFilter>('all');
  const [alerts, setAlerts] = useState(ALERTS);

  function markResolved(id: string) {
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, status: 'resolved' as AlertStatus } : a));
  }

  const filtered = catFilter === 'all' ? alerts : alerts.filter((a) => a.type === catFilter);

  const counts = {
    critical: alerts.filter((a) => a.priority === 'critical' && a.status !== 'resolved').length,
    high:     alerts.filter((a) => a.priority === 'high'     && a.status !== 'resolved').length,
    risk:     alerts.filter((a) => a.type === 'health'       && a.status !== 'resolved').length,
    action:   alerts.filter((a) => (a.priority === 'critical' || a.priority === 'high') && a.status === 'open').length,
  };

  return (
    <div className="space-y-6">

      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Critical Alerts Center</h1>
          <p className="text-[13.5px] text-gray-500 mt-1">Monitor project risks, delays, blockers, and operational issues in real time.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
            </span>
            <span className="text-[11.5px] font-semibold text-red-700">Live Monitoring</span>
          </div>
        </div>
      </div>

      {/* ── Summary Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Critical Alerts',       value: counts.critical, bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', sub: 'Immediate action needed' },
          { label: 'High Priority Alerts',  value: counts.high,     bg: '#FFF7ED', border: '#FED7AA', text: '#9A3412', sub: 'Requires attention today' },
          { label: 'Projects At Risk',      value: counts.risk,     bg: '#FEFCE8', border: '#FEF08A', text: '#854D0E', sub: 'Health score below 70' },
          { label: 'Action Required Today', value: counts.action,   bg: '#F9FAFB', border: '#E5E7EB', text: '#111111', sub: 'Open critical & high' },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border p-5"
            style={{ backgroundColor: c.bg, borderColor: c.border, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="text-[32px] font-extrabold leading-none" style={{ color: c.text }}>{c.value}</div>
            <div className="text-[12.5px] font-semibold mt-1.5" style={{ color: c.text }}>{c.label}</div>
            <div className="text-[11px] mt-0.5 text-gray-500">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-5">

        {/* ── Main column ───────────────────────────────────── */}
        <div className="col-span-8 space-y-5">

          {/* Category filter tabs */}
          <div className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-1 flex-wrap"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            {([
              { key: 'all',        label: 'All Alerts' },
              { key: 'delay',      label: 'Project Delays' },
              { key: 'blocked',    label: 'Dependency Blockers' },
              { key: 'workforce',  label: 'Workforce Issues' },
              { key: 'dpr',        label: 'Missing DPR' },
              { key: 'contractor', label: 'Contractor Risk' },
              { key: 'health',     label: 'Project Health' },
            ] as { key: CatFilter; label: string }[]).map((f) => (
              <button key={f.key} onClick={() => setCatFilter(f.key)}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
                style={{
                  backgroundColor: catFilter === f.key ? '#111111' : 'transparent',
                  color:           catFilter === f.key ? '#ffffff' : '#6b7280',
                }}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Alert cards */}
          <div className="space-y-3">
            {filtered.map((alert) => {
              const tm = TYPE_META[alert.type];
              const pri = PRI[alert.priority];
              const resolved = alert.status === 'resolved';
              return (
                <div key={alert.id}
                  className="bg-white rounded-xl border overflow-hidden transition-all"
                  style={{
                    borderColor: resolved ? '#e5e7eb' : pri.border,
                    opacity:     resolved ? 0.55 : 1,
                    boxShadow:   '0 1px 4px rgba(0,0,0,0.05)',
                  }}>
                  <div className="px-5 py-4">
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-[11px] font-bold font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                          {alert.id}
                        </span>
                        <span className="text-[12px] font-semibold px-2 py-0.5 rounded"
                          style={{ backgroundColor: pri.bg, color: tm.color }}>
                          {tm.label}
                        </span>
                        <span className="text-[13px] font-bold text-gray-900">{alert.project}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <PriBadge p={alert.priority} />
                        <StatusBadge s={alert.status} />
                      </div>
                    </div>

                    {/* Fields grid */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      {alert.fields.map((f) => (
                        <div key={f.label} className="rounded-lg px-3 py-2.5"
                          style={{ backgroundColor: pri.bg, border: `1px solid ${pri.border}` }}>
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{f.label}</div>
                          <div className="text-[12.5px] font-bold mt-0.5" style={{ color: pri.text }}>{f.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {alert.actions.map((action, i) => (
                        <ActionBtn key={action} label={action} primary={i === 0} />
                      ))}
                      {!resolved && (
                        <button onClick={() => markResolved(alert.id)}
                          className="px-2.5 py-1 rounded-lg text-[11.5px] font-medium border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition-colors ml-auto">
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right sidebar ─────────────────────────────────── */}
        <div className="col-span-4 space-y-4">

          {/* Recent Activity Feed */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-[13px] font-bold text-gray-900">Recent Activity</h3>
              <span className="text-[10px] text-gray-400">Today</span>
            </div>
            <div className="divide-y divide-gray-50">
              {ACTIVITY.map((a, i) => {
                const c = PRI[a.type];
                return (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full mt-1" style={{ backgroundColor: c.dot }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-gray-700 leading-snug">{a.text}</p>
                      <p className="text-[10.5px] text-gray-400 mt-0.5 font-mono">{a.time}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dashboard Widgets */}
          {/* Projects At Risk */}
          <div className="bg-white rounded-xl border border-gray-200 p-4"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 className="text-[12px] font-bold text-gray-900 uppercase tracking-wider mb-3">Projects At Risk</h3>
            {[
              { name: 'Swathi Villa',      score: 61, color: '#DC2626' },
              { name: 'Block B',           score: 72, color: '#EA580C' },
              { name: 'Block C',           score: 74, color: '#EA580C' },
            ].map((p) => (
              <div key={p.name} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <div className="text-[12.5px] font-semibold text-gray-800">{p.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="h-1.5 w-24 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${p.score}%`, backgroundColor: p.color }} />
                    </div>
                    <span className="text-[10.5px] font-bold" style={{ color: p.color }}>{p.score}</span>
                  </div>
                </div>
                <button className="text-[11px] text-gray-500 hover:text-gray-900 px-2 py-1 rounded bg-gray-50 hover:bg-gray-100 transition-colors">
                  Open →
                </button>
              </div>
            ))}
          </div>

          {/* Workforce Shortages */}
          <div className="bg-white rounded-xl border border-gray-200 p-4"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 className="text-[12px] font-bold text-gray-900 uppercase tracking-wider mb-3">Workforce Shortages</h3>
            {[
              { team: 'Team B — ABC Villa',      expected: 15, present: 9  },
              { team: 'Team D — Block C',        expected: 10, present: 7  },
              { team: 'Team A — Sunrise',        expected: 12, present: 10 },
            ].map((w) => (
              <div key={w.team} className="py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] font-semibold text-gray-800">{w.team}</span>
                  <span className="text-[11px] font-bold text-red-600">−{w.expected - w.present}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-red-400" style={{ width: `${(w.present / w.expected) * 100}%` }} />
                  </div>
                  <span className="text-[10.5px] text-gray-400">{w.present}/{w.expected}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Contractor Risk Rankings */}
          <div className="bg-white rounded-xl border border-gray-200 p-4"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 className="text-[12px] font-bold text-gray-900 uppercase tracking-wider mb-3">Contractor Risk</h3>
            {[
              { name: 'ABC Electrical', score: 690, issues: 12 },
              { name: 'FastBuild Civil',  score: 740, issues: 4  },
              { name: 'ProPlumb Works',  score: 780, issues: 2  },
            ].map((c, i) => {
              const color = c.score < 700 ? '#DC2626' : c.score < 760 ? '#EA580C' : '#CA8A04';
              return (
                <div key={c.name} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <span className="text-[10px] font-bold w-5 text-gray-400 flex-shrink-0">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-gray-800 truncate">{c.name}</div>
                    <div className="text-[10.5px] text-gray-400">{c.issues} issue{c.issues > 1 ? 's' : ''}</div>
                  </div>
                  <span className="text-[12px] font-extrabold tabular-nums" style={{ color }}>{c.score}</span>
                </div>
              );
            })}
          </div>

          {/* Missing DPR widget */}
          <div className="bg-white rounded-xl border border-gray-200 p-4"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 className="text-[12px] font-bold text-gray-900 uppercase tracking-wider mb-3">Missing DPR Today</h3>
            {[
              { name: 'Arjun K',   project: 'ABC Villa',     days: 2 },
              { name: 'Karthik V', project: 'ABC Villa',     days: 1 },
            ].map((d) => (
              <div key={d.name} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <div className="text-[12.5px] font-semibold text-gray-800">{d.name}</div>
                  <div className="text-[11px] text-gray-400">{d.project}</div>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                  {d.days}d missing
                </span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
