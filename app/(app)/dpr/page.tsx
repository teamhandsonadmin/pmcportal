'use client';

import { useState, useMemo } from 'react';

/* ─── Types ───────────────────────────────────────────────────── */
type DPRStatus =
  | 'Normal Progress' | 'Work Completed' | 'Material Awaited'
  | 'Drawing Pending' | 'Approval Pending' | 'Contractor Delay'
  | 'Labour Shortage' | 'Equipment Issue' | 'Weather Impact' | 'Site Access Issue';

type Project = 'ABC Villa';

interface DPREntry {
  id: string;
  project: Project;
  engineer: string;
  time: string;
  date: string;
  workCompleted: string;
  workPlanned: string;
  progress: number;
  status: DPRStatus;
  comments: string;
  manpower: number;
  materials: string[];
  zone: string;
}

/* ─── Config ──────────────────────────────────────────────────── */
const STATUS_STYLE: Record<DPRStatus, { bg: string; text: string; border: string; dot: string }> = {
  'Normal Progress':  { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0', dot: '#22C55E' },
  'Work Completed':   { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0', dot: '#10B981' },
  'Material Awaited': { bg: '#FFF7ED', text: '#9A3412', border: '#FED7AA', dot: '#F97316' },
  'Drawing Pending':  { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE', dot: '#3B82F6' },
  'Approval Pending': { bg: '#F5F3FF', text: '#5B21B6', border: '#DDD6FE', dot: '#8B5CF6' },
  'Contractor Delay': { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA', dot: '#EF4444' },
  'Labour Shortage':  { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA', dot: '#DC2626' },
  'Equipment Issue':  { bg: '#FEFCE8', text: '#854D0E', border: '#FEF08A', dot: '#EAB308' },
  'Weather Impact':   { bg: '#F9FAFB', text: '#374151', border: '#E5E7EB', dot: '#9CA3AF' },
  'Site Access Issue':{ bg: '#FFF1F2', text: '#9F1239', border: '#FFE4E6', dot: '#F43F5E' },
};

const PROJECT_COLOR: Record<Project, string> = {
  'ABC Villa': '#111827',
};

const ALL_STATUSES: DPRStatus[] = [
  'Normal Progress','Work Completed','Material Awaited','Drawing Pending',
  'Approval Pending','Contractor Delay','Labour Shortage','Equipment Issue',
  'Weather Impact','Site Access Issue',
];

/* ─── Data ────────────────────────────────────────────────────── */
const ENTRIES: DPREntry[] = [
  {
    id: 'DPR-001', project: 'ABC Villa', engineer: 'Kumar S', time: '11:30 AM', date: '22 Jun 2026',
    workCompleted: 'HVAC Duct Installation – Block A',
    workPlanned: 'HVAC Duct Installation – Block B',
    progress: 65, status: 'Normal Progress',
    comments: 'Material for Block B expected tomorrow. Duct alignment complete on Block A. Team of 8 deployed.',
    manpower: 8, materials: ['GI Ducts 300mm', 'Insulation Wrap', 'MS Clamps'], zone: 'Block A – Level 2',
  },
  {
    id: 'DPR-002', project: 'ABC Villa', engineer: 'Arjun K', time: '2:30 PM', date: '22 Jun 2026',
    workCompleted: 'Electrical Conduit Routing – Phase 1',
    workPlanned: 'LV Panel Installation',
    progress: 80, status: 'Approval Pending',
    comments: 'Waiting for consultant approval on LV panel location. Conduit routing 80% done on Block C.',
    manpower: 6, materials: ['20mm Conduit', 'Saddles', 'Draw Wire'], zone: 'Block C – Level 3',
  },
  {
    id: 'DPR-003', project: 'ABC Villa', engineer: 'Manoj R', time: '5:30 PM', date: '22 Jun 2026',
    workCompleted: 'Plumbing CPVC Pipe Routing – Block B',
    workPlanned: 'Water Pressure Testing',
    progress: 90, status: 'Work Completed',
    comments: 'No major issues reported today. Final pressure test scheduled for tomorrow.',
    manpower: 5, materials: ['CPVC Pipe 25mm', 'Fittings', 'Teflon Tape'], zone: 'Block B – Level 2',
  },
  {
    id: 'DPR-004', project: 'ABC Villa', engineer: 'Sanjay T', time: '9:00 AM', date: '22 Jun 2026',
    workCompleted: 'False Ceiling GI Frame – Block A Level 4',
    workPlanned: 'Gypsum Sheet Fixing',
    progress: 45, status: 'Equipment Issue',
    comments: 'Lift platform breakdown at 11 AM. Maintenance team called. Work halted for 3 hours.',
    manpower: 6, materials: ['GI Channels 70mm', 'GI Runners', 'Anchor Bolts'], zone: 'Block A – Level 4',
  },
  {
    id: 'DPR-005', project: 'ABC Villa', engineer: 'Priya R', time: '3:45 PM', date: '22 Jun 2026',
    workCompleted: 'Internal Plastering – Unit 4A',
    workPlanned: 'Internal Plastering – Unit 4B',
    progress: 55, status: 'Labour Shortage',
    comments: '3 plasterers absent today. Progress slower than planned. Will arrange extra team tomorrow.',
    manpower: 7, materials: ['Sand', 'Cement', 'Bonding Agent'], zone: 'Block B – Unit 4A',
  },
  {
    id: 'DPR-006', project: 'ABC Villa', engineer: 'Ravi M', time: '1:00 PM', date: '22 Jun 2026',
    workCompleted: 'Waterproofing – Terrace Level',
    workPlanned: 'Protective Screed Over Waterproofing',
    progress: 70, status: 'Material Awaited',
    comments: 'Protective screed material not yet delivered. Estimated delivery by 4 PM.',
    manpower: 4, materials: ['Waterproofing Membrane', 'Primer'], zone: 'Terrace – Level 5',
  },
  {
    id: 'DPR-007', project: 'ABC Villa', engineer: 'Karthik V', time: '10:15 AM', date: '22 Jun 2026',
    workCompleted: 'Block Work – Block D Grid F4 to F8',
    workPlanned: 'Block Work – Block D Grid F9 to F12',
    progress: 60, status: 'Normal Progress',
    comments: 'Steady progress. Mortar mix quality checked by QC team. Passed inspection.',
    manpower: 10, materials: ['AAC Blocks', 'Mortar', 'Chicken Mesh'], zone: 'Block D – Level 2',
  },
  {
    id: 'DPR-008', project: 'ABC Villa', engineer: 'Deepa N', time: '4:00 PM', date: '22 Jun 2026',
    workCompleted: 'Tile Work – Master Bedroom Unit 2B',
    workPlanned: 'Tile Work – Master Bathroom',
    progress: 85, status: 'Normal Progress',
    comments: 'All tiles aligned and levelled. Grout will be applied after 24 hours.',
    manpower: 3, materials: ['Vitrified Tiles 600×600', 'Tile Adhesive', 'Grout'], zone: 'Block B – Unit 2B',
  },
  {
    id: 'DPR-009', project: 'ABC Villa', engineer: 'Kumar S', time: '06:30 PM', date: '21 Jun 2026',
    workCompleted: 'HVAC AHU Installation – Terrace',
    workPlanned: 'Duct Connection to AHU',
    progress: 100, status: 'Work Completed',
    comments: "AHU placed and anchored. Electrical connection pending from Arjun's team.",
    manpower: 6, materials: ['AHU Unit', 'Anchor Bolts', 'Anti-Vibration Pads'], zone: 'Terrace Level',
  },
  {
    id: 'DPR-010', project: 'ABC Villa', engineer: 'Sanjay T', time: '5:00 PM', date: '21 Jun 2026',
    workCompleted: 'Marble Flooring – Ground Floor Lobby',
    workPlanned: 'Marble Polishing',
    progress: 40, status: 'Drawing Pending',
    comments: 'Revised layout drawing for lobby not received. Waiting from architect.',
    manpower: 5, materials: ['Marble Slabs', 'Adhesive', 'Polish'], zone: 'Ground Floor – Lobby',
  },
];

const TIMELINE = [
  { time: '06:00 AM', event: 'DPR window opens', type: 'info' },
  { time: '09:00 AM', event: 'DPR-007 submitted — Karthik V (Block D)', type: 'success' },
  { time: '10:15 AM', event: 'DPR-004 submitted — Sanjay T (Block A Level 4)', type: 'success' },
  { time: '11:30 AM', event: 'DPR-001 submitted — Kumar S (Block A Level 2)', type: 'success' },
  { time: '01:00 PM', event: 'DPR-006 submitted — Ravi M (Terrace Level 5)', type: 'warning' },
  { time: '02:30 PM', event: 'DPR-002 submitted — Arjun K (Block C Level 3)', type: 'warning' },
  { time: '03:45 PM', event: 'DPR-005 submitted — Priya R (Block B Unit 4A)', type: 'error' },
  { time: '04:00 PM', event: 'DPR-008 submitted — Deepa N (Block B Unit 2B)', type: 'success' },
  { time: '05:30 PM', event: 'DPR-003 submitted — Manoj R (Block B Level 2)', type: 'success' },
  { time: '06:00 PM', event: '2 reports still pending', type: 'error' },
];

const BLANK_FORM = {
  project:       '',
  engineer:      '',
  zone:          '',
  workCompleted: '',
  workPlanned:   '',
  progress:      50,
  status:        'Normal Progress' as DPRStatus,
  manpower:      0,
  comments:      '',
};

/* ─── Helpers ─────────────────────────────────────────────────── */
function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

function progressColor(pct: number, status: DPRStatus) {
  if (status === 'Contractor Delay' || status === 'Labour Shortage' || status === 'Equipment Issue') return '#EF4444';
  if (status === 'Material Awaited' || status === 'Drawing Pending' || status === 'Approval Pending') return '#F97316';
  if (pct >= 90) return '#10B981';
  if (pct >= 60) return '#22C55E';
  return '#3B82F6';
}

function StatusBadge({ s }: { s: DPRStatus }) {
  const c = STATUS_STYLE[s];
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap"
      style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.dot }} />
      {s}
    </span>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function DPRPage() {
  const [search,         setSearch]         = useState('');
  const [projectFilter,  setProjectFilter]  = useState('All');
  const [statusFilter,   setStatusFilter]   = useState('All');
  const [dateFilter,     setDateFilter]     = useState('All');
  const [expanded,       setExpanded]       = useState<Set<string>>(new Set(['DPR-001']));
  const [showForm,       setShowForm]       = useState(false);
  const [formData,       setFormData]       = useState(BLANK_FORM);
  const [notification,   setNotification]   = useState('');
  const [submitted,      setSubmitted]      = useState<string[]>([]);

  const dates    = ['All', ...Array.from(new Set(ENTRIES.map((e) => e.date)))];
  const projects = ['All', ...Array.from(new Set(ENTRIES.map((e) => e.project)))];

  const filtered = useMemo(() => ENTRIES.filter((e) => {
    if (projectFilter !== 'All' && e.project !== projectFilter) return false;
    if (statusFilter  !== 'All' && e.status  !== statusFilter)  return false;
    if (dateFilter    !== 'All' && e.date    !== dateFilter)    return false;
    if (search && !e.workCompleted.toLowerCase().includes(search.toLowerCase()) &&
        !e.engineer.toLowerCase().includes(search.toLowerCase()) &&
        !e.project.toLowerCase().includes(search.toLowerCase()))  return false;
    return true;
  }), [search, projectFilter, statusFilter, dateFilter]);

  function toggle(id: string) {
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function notify(msg: string) {
    setNotification(msg); setTimeout(() => setNotification(''), 2500);
  }

  function handleSubmit() {
    if (!formData.project || !formData.engineer || !formData.workCompleted) {
      notify('Please fill in all required fields.'); return;
    }
    setSubmitted((prev) => [...prev, formData.project]);
    setFormData(BLANK_FORM);
    setShowForm(false);
    notify('DPR submitted successfully!');
  }

  const compliantCount = ENTRIES.filter((e) => e.status !== 'Labour Shortage' && e.status !== 'Contractor Delay').length;
  const compliance = Math.round((compliantCount / ENTRIES.length) * 100);

  return (
    <div className="space-y-5">

      {/* ── Toast ─────────────────────────────────────────── */}
      {notification && (
        <div className="fixed top-5 right-6 z-50 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-[13px] font-medium"
          style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.18)', zIndex: 9999 }}>
          {notification}
        </div>
      )}

      {/* ── Submit DPR Modal ───────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden"
            style={{ boxShadow: '0 32px 64px rgba(0,0,0,0.25)' }}
            onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-[15px] font-bold text-gray-900">Submit Daily Progress Report</h2>
                <p className="text-[12px] text-gray-400 mt-0.5">22 Jun 2026</p>
              </div>
              <button onClick={() => setShowForm(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
                ✕
              </button>
            </div>
            {/* Form body */}
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Project *">
                  <select value={formData.project} onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                    className="form-select">
                    <option value="">Select project</option>
                    {['ABC Villa'].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Engineer Name *">
                  <input value={formData.engineer} onChange={(e) => setFormData({ ...formData, engineer: e.target.value })}
                    placeholder="e.g. Kumar S" className="form-input" />
                </FormField>
                <FormField label="Zone / Block">
                  <input value={formData.zone} onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                    placeholder="e.g. Block A – Level 2" className="form-input" />
                </FormField>
                <FormField label="Manpower">
                  <input type="number" min={0} value={formData.manpower || ''}
                    onChange={(e) => setFormData({ ...formData, manpower: +e.target.value })}
                    placeholder="No. of workers" className="form-input" />
                </FormField>
              </div>

              <FormField label="Work Completed Today *">
                <input value={formData.workCompleted}
                  onChange={(e) => setFormData({ ...formData, workCompleted: e.target.value })}
                  placeholder="Describe the work done today" className="form-input" />
              </FormField>

              <FormField label="Work Planned for Tomorrow">
                <input value={formData.workPlanned}
                  onChange={(e) => setFormData({ ...formData, workPlanned: e.target.value })}
                  placeholder="What is planned next?" className="form-input" />
              </FormField>

              <FormField label={`Progress: ${formData.progress}%`}>
                <input type="range" min={0} max={100} value={formData.progress}
                  onChange={(e) => setFormData({ ...formData, progress: +e.target.value })}
                  className="w-full accent-gray-900" />
                <div className="h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                  <div className="h-full rounded-full bg-gray-900 transition-all" style={{ width: `${formData.progress}%` }} />
                </div>
              </FormField>

              <FormField label="Status">
                <div className="grid grid-cols-2 gap-1.5">
                  {ALL_STATUSES.map((s) => {
                    const c = STATUS_STYLE[s];
                    const active = formData.status === s;
                    return (
                      <button key={s} onClick={() => setFormData({ ...formData, status: s })}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[11.5px] font-medium text-left transition-all"
                        style={{
                          background:  active ? c.bg : '#f9fafb',
                          borderColor: active ? c.border : '#e5e7eb',
                          color:       active ? c.text : '#6b7280',
                          fontWeight:  active ? '700' : '500',
                        }}>
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: active ? c.dot : '#d1d5db' }} />
                        {s}
                      </button>
                    );
                  })}
                </div>
              </FormField>

              <FormField label="Comments / Remarks">
                <textarea rows={3} value={formData.comments}
                  onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                  placeholder="Any issues, notes, or observations…"
                  className="form-input resize-none" />
              </FormField>
            </div>
            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2.5">
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSubmit}
                className="px-5 py-2 rounded-lg bg-gray-900 text-white text-[13px] font-semibold hover:bg-gray-700 transition-colors">
                Submit DPR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Daily Progress Reports</h1>
          <p className="text-[13.5px] text-gray-500 mt-1">Daily site updates, progress tracking, and reporting.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button onClick={() => notify('Export PDF: Feature coming soon')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export PDF
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-[13px] font-semibold hover:bg-gray-800 transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Submit DPR
          </button>
        </div>
      </div>

      {/* ── Summary Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Reports Submitted Today', value: 24 + submitted.length, sub: 'Out of 27 expected',       pct: null, dot: '#22C55E' },
          { label: 'Pending Reports',          value: Math.max(0, 3 - submitted.length), sub: 'Due by 6:00 PM',   pct: null, dot: '#EF4444' },
          { label: 'Active Projects',          value: 18,                                sub: '5 sites reporting', pct: null, dot: '#3B82F6' },
          { label: 'DPR Submission Rate',       value: `${compliance}%`,                 sub: 'Last 30 days',      pct: compliance, dot: '#10B981' },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-5"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="w-2 h-2 rounded-full" style={{ background: c.dot }} />
            </div>
            <div className="text-[28px] font-extrabold text-gray-900 leading-none">{c.value}</div>
            <div className="text-[12px] font-semibold text-gray-700 mt-1.5">{c.label}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">{c.sub}</div>
            {c.pct !== null && (
              <div className="h-1.5 bg-gray-100 rounded-full mt-3 overflow-hidden">
                <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${c.pct}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-5">

        {/* ── Left: DPR entries ─────────────────────────────── */}
        <div className="col-span-8 space-y-3">

          {/* Filter bar */}
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3 flex-wrap"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center gap-2 flex-1 min-w-[160px] bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search reports…"
                className="flex-1 bg-transparent text-[12.5px] text-gray-700 placeholder-gray-400 outline-none" />
              {search && <button onClick={() => setSearch('')} className="text-gray-400 text-xs">✕</button>}
            </div>

            <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}
              className="text-[12.5px] text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none">
              {projects.map((p) => <option key={p}>{p === 'All' ? 'All Projects' : p}</option>)}
            </select>

            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="text-[12.5px] text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none">
              <option value="All">All Statuses</option>
              {ALL_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>

            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
              className="text-[12.5px] text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none">
              {dates.map((d) => <option key={d}>{d === 'All' ? 'All Dates' : d}</option>)}
            </select>

            <span className="text-[12px] text-gray-400 ml-auto whitespace-nowrap">{filtered.length} reports</span>
          </div>

          {/* DPR Cards */}
          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 py-14 text-center"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <p className="text-[14px] font-semibold text-gray-500">No reports found</p>
              <p className="text-[12.5px] text-gray-400 mt-1">Try adjusting your filters.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((entry) => {
                const isOpen = expanded.has(entry.id);
                const projColor = PROJECT_COLOR[entry.project];
                const barColor  = progressColor(entry.progress, entry.status);
                return (
                  <div key={entry.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                    style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>

                    {/* Card header — always visible */}
                    <button className="w-full px-5 py-4 text-left" onClick={() => toggle(entry.id)}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {/* Avatar */}
                          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: projColor }}>
                            <span className="text-[11px] font-bold text-white">{initials(entry.engineer)}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <span className="text-[13.5px] font-bold text-gray-900">{entry.project}</span>
                              <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{entry.id}</span>
                              <StatusBadge s={entry.status} />
                            </div>
                            <p className="text-[12.5px] text-gray-600 truncate">{entry.workCompleted}</p>
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              <span className="flex items-center gap-1 text-[11px] text-gray-400">
                                <span className="w-4 h-4 rounded-full inline-flex items-center justify-center bg-gray-200 text-[7px] font-bold"
                                  style={{ color: '#374151' }}>{initials(entry.engineer)}</span>
                                {entry.engineer}
                              </span>
                              <span className="text-[11px] text-gray-400 font-mono">{entry.time} · {entry.date}</span>
                              <span className="flex items-center gap-1 text-[11px] text-gray-400">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                {entry.zone}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {/* Progress pill */}
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${entry.progress}%`, backgroundColor: barColor }} />
                            </div>
                            <span className="text-[12px] font-bold tabular-nums" style={{ color: barColor }}>{entry.progress}%</span>
                          </div>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.2"
                            style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                            <polyline points="6 9 12 15 18 9"/>
                          </svg>
                        </div>
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {isOpen && (
                      <div className="px-5 pb-5 border-t border-gray-100">
                        <div className="grid grid-cols-2 gap-4 mt-4">

                          {/* Left column */}
                          <div className="space-y-4">
                            <DetailSection title="Work Completed">
                              <p className="text-[13px] text-gray-700">{entry.workCompleted}</p>
                            </DetailSection>
                            <DetailSection title="Work Planned Tomorrow">
                              <p className="text-[13px] text-gray-700">{entry.workPlanned}</p>
                            </DetailSection>
                            <DetailSection title="Remarks">
                              <p className="text-[12.5px] text-gray-600 leading-relaxed">{entry.comments}</p>
                            </DetailSection>
                          </div>

                          {/* Right column */}
                          <div className="space-y-4">
                            <DetailSection title="Manpower">
                              <div className="flex items-center gap-2">
                                <div className="flex -space-x-1.5">
                                  {Array.from({ length: Math.min(entry.manpower, 5) }).map((_, i) => (
                                    <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-gray-700 flex items-center justify-center">
                                      <span className="text-[7px] text-white font-bold">{i + 1}</span>
                                    </div>
                                  ))}
                                  {entry.manpower > 5 && (
                                    <div className="w-6 h-6 rounded-full border-2 border-white bg-gray-300 flex items-center justify-center">
                                      <span className="text-[7px] text-gray-700 font-bold">+{entry.manpower - 5}</span>
                                    </div>
                                  )}
                                </div>
                                <span className="text-[13px] font-bold text-gray-900">{entry.manpower} workers</span>
                              </div>
                            </DetailSection>
                            <DetailSection title="Materials Used">
                              <div className="flex flex-wrap gap-1.5">
                                {entry.materials.map((m) => (
                                  <span key={m} className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600">
                                    {m}
                                  </span>
                                ))}
                              </div>
                            </DetailSection>
                            <DetailSection title="Overall Progress">
                              <div className="flex items-center gap-3 mt-1">
                                <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all" style={{ width: `${entry.progress}%`, backgroundColor: barColor }} />
                                </div>
                                <span className="text-[14px] font-extrabold tabular-nums" style={{ color: barColor }}>{entry.progress}%</span>
                              </div>
                            </DetailSection>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                          <button onClick={() => notify(`Editing ${entry.id}…`)}
                            className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-gray-900 text-white hover:bg-gray-700 transition-colors">
                            Edit Report
                          </button>
                          <button onClick={() => notify(`Downloading PDF for ${entry.id}`)}
                            className="px-3 py-1.5 rounded-lg text-[12px] font-medium border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors">
                            Export PDF
                          </button>
                          <button onClick={() => notify(`Viewing full report for ${entry.id}`)}
                            className="px-3 py-1.5 rounded-lg text-[12px] font-medium border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors">
                            View Full Report
                          </button>
                          <span className="ml-auto text-[11px] text-gray-400">Last updated: {entry.time}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Right panel ──────────────────────────────────── */}
        <div className="col-span-4 space-y-4">

          {/* Submission rate widget */}
          <div className="bg-white rounded-xl border border-gray-200 p-5"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 className="text-[12.5px] font-bold text-gray-900 uppercase tracking-wider mb-4">DPR Submission Rate — Jun 2026</h3>
            {[
              { engineer: 'Kumar S',   pct: 95 },
              { engineer: 'Priya R',   pct: 88 },
              { engineer: 'Arjun K',   pct: 100 },
              { engineer: 'Manoj R',   pct: 72 },
              { engineer: 'Nithya P',  pct: 83 },
            ].map((r) => {
              const color = r.pct >= 90 ? '#22C55E' : r.pct >= 80 ? '#F97316' : '#EF4444';
              return (
                <div key={r.engineer} className="mb-3 last:mb-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-semibold text-gray-700">{r.engineer}</span>
                    <span className="text-[12px] font-bold tabular-nums" style={{ color }}>{r.pct}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${r.pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Status breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-5"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 className="text-[12.5px] font-bold text-gray-900 uppercase tracking-wider mb-3">Today's Status Breakdown</h3>
            {([
              ['Normal Progress',  3],
              ['Work Completed',   2],
              ['Approval Pending', 1],
              ['Equipment Issue',  1],
              ['Labour Shortage',  1],
              ['Material Awaited', 1],
              ['Drawing Pending',  1],
            ] as [DPRStatus, number][]).map(([s, count]) => {
              const c = STATUS_STYLE[s];
              const pct = Math.round((count / 10) * 100);
              return (
                <div key={s} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.dot }} />
                  <span className="text-[12px] text-gray-600 flex-1">{s}</span>
                  <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.dot }} />
                  </div>
                  <span className="text-[11.5px] font-bold text-gray-700 w-4 text-right">{count}</span>
                </div>
              );
            })}
          </div>

          {/* Activity timeline */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-[12.5px] font-bold text-gray-900 uppercase tracking-wider">Submission Timeline</h3>
              <span className="text-[10px] text-gray-400">Today · 22 Jun</span>
            </div>
            <div className="px-4 py-3 space-y-0">
              {TIMELINE.map((t, i) => {
                const dotColor = t.type === 'success' ? '#22C55E' : t.type === 'warning' ? '#F97316' : t.type === 'error' ? '#EF4444' : '#9CA3AF';
                const isLast = i === TIMELINE.length - 1;
                return (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: dotColor }} />
                      {!isLast && <div className="w-px flex-1 bg-gray-100 my-0.5" style={{ minHeight: '20px' }} />}
                    </div>
                    <div className="pb-3 min-w-0">
                      <p className="text-[10.5px] font-mono text-gray-400">{t.time}</p>
                      <p className="text-[12px] text-gray-700 leading-snug">{t.event}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pending engineers */}
          <div className="bg-white rounded-xl border border-red-200 p-4"
            style={{ backgroundColor: '#FEF2F2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 className="flex items-center gap-1.5 text-[12px] font-bold text-red-700 uppercase tracking-wider mb-3">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Pending Reports
            </h3>
            {[
              { name: 'Nithya P',  zone: 'Block A – Level 3', due: '6:00 PM' },
              { name: 'Manoj R',   zone: 'Block B – Level 1', due: '6:00 PM' },
            ].map((p, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-red-100 last:border-0">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-red-700 flex items-center justify-center">
                    <span className="text-[8px] font-bold text-white">{initials(p.name)}</span>
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-red-900">{p.name}</p>
                    <p className="text-[10.5px] text-red-500">{p.zone}</p>
                  </div>
                </div>
                <span className="text-[10.5px] font-mono text-red-500">Due {p.due}</span>
              </div>
            ))}
            <button className="mt-3 w-full py-1.5 rounded-lg text-[12px] font-semibold text-red-700 border border-red-200 bg-white hover:bg-red-50 transition-colors"
              onClick={() => notify('Reminder sent to all pending engineers')}>
              Send Reminder to All
            </button>
          </div>

        </div>
      </div>

      <style>{`
        .form-input {
          width: 100%; padding: 8px 12px; font-size: 13px; color: #111827;
          background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; outline: none;
          transition: border-color 0.15s;
        }
        .form-input:focus { border-color: #9ca3af; background: #fff; }
        .form-select {
          width: 100%; padding: 8px 12px; font-size: 13px; color: #374151;
          background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; outline: none;
        }
      `}</style>
    </div>
  );
}

/* ─── Detail section ─────────────────────────────────────────── */
function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10.5px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">{title}</p>
      {children}
    </div>
  );
}

/* ─── Form field ─────────────────────────────────────────────── */
function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
