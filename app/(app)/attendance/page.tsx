'use client';

import { useState, useMemo } from 'react';

/* ─── Types ───────────────────────────────────────────────────── */
type AttStatus = 'Present' | 'Absent' | 'Late' | 'On Leave' | 'Half Day';
type Role = 'Site Engineer' | 'Contractor' | 'Consultant' | 'Vendor' | 'Supervisor' | 'Labour';
type Project = 'ABC Villa';

interface Person {
  id: string; name: string; role: Role; project: Project;
  checkIn: string; checkOut: string; status: AttStatus; phone: string;
}

/* ─── Style maps ──────────────────────────────────────────────── */
const STATUS_STYLE: Record<AttStatus, { bg: string; text: string; border: string; dot: string }> = {
  'Present':  { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0', dot: '#22C55E' },
  'Late':     { bg: '#FFF7ED', text: '#9A3412', border: '#FED7AA', dot: '#F97316' },
  'Absent':   { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA', dot: '#EF4444' },
  'On Leave': { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE', dot: '#3B82F6' },
  'Half Day': { bg: '#FEFCE8', text: '#854D0E', border: '#FEF08A', dot: '#EAB308' },
};

const ROLE_COLOR: Record<Role, { bg: string; text: string }> = {
  'Site Engineer': { bg: '#111827', text: '#fff' },
  'Contractor':    { bg: '#1E3A5F', text: '#fff' },
  'Consultant':    { bg: '#166534', text: '#fff' },
  'Vendor':        { bg: '#7C2D12', text: '#fff' },
  'Supervisor':    { bg: '#4C1D95', text: '#fff' },
  'Labour':        { bg: '#374151', text: '#fff' },
};

const PROJ_COLOR: Record<Project, string> = {
  'ABC Villa': '#111827',
};

/* ─── Data ────────────────────────────────────────────────────── */
const PEOPLE: Person[] = [
  { id: 'e01', name: 'Kumar S',      role: 'Site Engineer', project: 'ABC Villa', checkIn: '09:05 AM', checkOut: '--',      status: 'Present',  phone: '98400-11001' },
  { id: 'e02', name: 'Arjun K',      role: 'Site Engineer', project: 'ABC Villa', checkIn: '08:55 AM', checkOut: '--',      status: 'Present',  phone: '98400-11002' },
  { id: 'e03', name: 'Manoj R',      role: 'Contractor',    project: 'ABC Villa', checkIn: '--',       checkOut: '--',      status: 'Absent',   phone: '98400-11003' },
  { id: 'e04', name: 'Priya R',      role: 'Site Engineer', project: 'ABC Villa', checkIn: '09:42 AM', checkOut: '--',      status: 'Late',     phone: '98400-11004' },
  { id: 'e05', name: 'Sanjay T',     role: 'Supervisor',    project: 'ABC Villa', checkIn: '08:30 AM', checkOut: '--',      status: 'Present',  phone: '98400-11005' },
  { id: 'e06', name: 'Ravi M',       role: 'Consultant',    project: 'ABC Villa', checkIn: '10:15 AM', checkOut: '--',      status: 'Late',     phone: '98400-11006' },
  { id: 'e07', name: 'Deepa N',      role: 'Site Engineer', project: 'ABC Villa', checkIn: '09:00 AM', checkOut: '--',      status: 'Present',  phone: '98400-11007' },
  { id: 'e08', name: 'Karthik V',    role: 'Contractor',    project: 'ABC Villa', checkIn: '08:50 AM', checkOut: '--',      status: 'Present',  phone: '98400-11008' },
  { id: 'e09', name: 'Nithya P',     role: 'Site Engineer', project: 'ABC Villa', checkIn: '--',       checkOut: '--',      status: 'On Leave', phone: '98400-11009' },
  { id: 'e10', name: 'Suresh B',     role: 'Labour',        project: 'ABC Villa', checkIn: '08:00 AM', checkOut: '--',      status: 'Present',  phone: '98400-11010' },
  { id: 'e11', name: 'Anand V',      role: 'Labour',        project: 'ABC Villa', checkIn: '--',       checkOut: '--',      status: 'Absent',   phone: '98400-11011' },
  { id: 'e12', name: 'Meena K',      role: 'Vendor',        project: 'ABC Villa', checkIn: '11:00 AM', checkOut: '01:30 PM',status: 'Half Day', phone: '98400-11012' },
  { id: 'e13', name: 'Rajesh T',     role: 'Supervisor',    project: 'ABC Villa', checkIn: '09:10 AM', checkOut: '--',      status: 'Present',  phone: '98400-11013' },
  { id: 'e14', name: 'Kavitha S',    role: 'Consultant',    project: 'ABC Villa', checkIn: '--',       checkOut: '--',      status: 'Absent',   phone: '98400-11014' },
  { id: 'e15', name: 'Vikram N',     role: 'Contractor',    project: 'ABC Villa', checkIn: '08:45 AM', checkOut: '--',      status: 'Present',  phone: '98400-11015' },
  { id: 'e16', name: 'Selva R',      role: 'Labour',        project: 'ABC Villa', checkIn: '--',       checkOut: '--',      status: 'Absent',   phone: '98400-11016' },
  { id: 'e17', name: 'Geetha D',     role: 'Site Engineer', project: 'ABC Villa', checkIn: '09:00 AM', checkOut: '--',      status: 'Present',  phone: '98400-11017' },
  { id: 'e18', name: 'Bala K',       role: 'Labour',        project: 'ABC Villa', checkIn: '08:20 AM', checkOut: '--',      status: 'Present',  phone: '98400-11018' },
  { id: 'e19', name: 'Muthu S',      role: 'Labour',        project: 'ABC Villa', checkIn: '09:55 AM', checkOut: '--',      status: 'Late',     phone: '98400-11019' },
  { id: 'e20', name: 'Devi R',       role: 'Vendor',        project: 'ABC Villa', checkIn: '--',       checkOut: '--',      status: 'On Leave', phone: '98400-11020' },
];

const PROJECT_SUMMARY = [
  { project: 'ABC Villa' as Project, expected: 20, present: 14, absent: 4,  late: 2 },
];

const WEEKLY = [
  { day: 'Mon', present: 17, absent: 2, late: 1 },
  { day: 'Tue', present: 18, absent: 1, late: 2 },
  { day: 'Wed', present: 16, absent: 3, late: 1 },
  { day: 'Thu', present: 15, absent: 4, late: 2 },
  { day: 'Fri', present: 17, absent: 2, late: 2 },
  { day: 'Sat', present: 13, absent: 7, late: 0 },
  { day: 'Today', present: 14, absent: 4, late: 2 },
];

const DAILY_RATE = [85, 90, 80, 75, 85, 65, 70];

const BLANK_FORM = { name: '', role: 'Site Engineer' as Role, project: 'ABC Villa' as Project, checkIn: '', status: 'Present' as AttStatus };

let nextId = 200;
function uid() { return `e${++nextId}`; }
function initials(n: string) { return n.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2); }

/* ─── SVG helpers ─────────────────────────────────────────────── */
function BarChart({ data, labels, colors }: {
  data: number[][]; labels: string[]; colors: string[];
}) {
  const W = 320, H = 90, pad = { t: 8, r: 4, b: 22, l: 24 };
  const max = Math.max(...data.flat()) + 10;
  const bw = (W - pad.l - pad.r) / labels.length;
  const bGap = 3; const bCount = data.length;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      {[0, 0.5, 1].map((f) => {
        const y = pad.t + (H - pad.t - pad.b) * (1 - f);
        return (
          <g key={f}>
            <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="#f3f4f6" strokeWidth="1" />
            <text x={pad.l - 3} y={y + 3.5} textAnchor="end" fontSize="8" fill="#9ca3af">{Math.round(max * f)}</text>
          </g>
        );
      })}
      {labels.map((lbl, i) => {
        const slotX = pad.l + i * bw;
        const eachW = (bw - bGap * (bCount + 1)) / bCount;
        return (
          <g key={lbl}>
            {data.map((series, si) => {
              const bh = ((series[i] ?? 0) / max) * (H - pad.t - pad.b);
              const bx = slotX + bGap * (si + 1) + eachW * si;
              const by = H - pad.b - bh;
              return <rect key={si} x={bx} y={by} width={eachW} height={bh} rx="2" fill={colors[si]} opacity="0.85" />;
            })}
            <text x={slotX + bw / 2} y={H - 5} textAnchor="middle" fontSize="8" fill="#9ca3af">{lbl}</text>
          </g>
        );
      })}
    </svg>
  );
}

function LineChart({ data, labels, color }: { data: number[]; labels: string[]; color: string }) {
  const W = 320, H = 70, pad = { t: 6, r: 4, b: 18, l: 24 };
  const min = Math.min(...data) - 3;
  const max = Math.max(...data) + 3;
  const xStep = (W - pad.l - pad.r) / (data.length - 1);
  const pts = data.map((v, i) => ({
    x: pad.l + i * xStep,
    y: pad.t + (H - pad.t - pad.b) * (1 - (v - min) / (max - min)),
  }));
  const poly = pts.map((p) => `${p.x},${p.y}`).join(' ');
  const area = `${pts[0].x},${H - pad.b} ${poly} ${pts[pts.length - 1].x},${H - pad.b}`;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      <polygon points={area} fill={color} opacity="0.08" />
      <polyline points={poly} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#fff" stroke={color} strokeWidth="1.8" />
      ))}
      {labels.map((l, i) => (
        <text key={l} x={pad.l + i * xStep} y={H - 3} textAnchor="middle" fontSize="8" fill="#9ca3af">{l}</text>
      ))}
    </svg>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function AttendancePage() {
  const [people,       setPeople]       = useState<Person[]>(PEOPLE);
  const [projectF,     setProjectF]     = useState('All');
  const [roleF,        setRoleF]        = useState('All');
  const [statusF,      setStatusF]      = useState('All');
  const [search,       setSearch]       = useState('');
  const [showForm,     setShowForm]     = useState(false);
  const [editId,       setEditId]       = useState<string | null>(null);
  const [form,         setForm]         = useState(BLANK_FORM);
  const [notification, setNotification] = useState('');
  const [activeTab,    setActiveTab]    = useState<'daily' | 'weekly' | 'trend'>('weekly');

  function notify(msg: string) { setNotification(msg); setTimeout(() => setNotification(''), 2500); }

  const filtered = useMemo(() => people.filter((p) => {
    if (projectF !== 'All' && p.project !== projectF) return false;
    if (roleF    !== 'All' && p.role    !== roleF)    return false;
    if (statusF  !== 'All' && p.status  !== statusF)  return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !p.project.toLowerCase().includes(search.toLowerCase()))     return false;
    return true;
  }), [people, projectF, roleF, statusF, search]);

  const stats = useMemo(() => ({
    present: people.filter((p) => p.status === 'Present').length,
    absent:  people.filter((p) => p.status === 'Absent').length,
    late:    people.filter((p) => p.status === 'Late').length,
    leave:   people.filter((p) => p.status === 'On Leave').length,
    total:   people.length,
  }), [people]);

  const rate = Math.round((stats.present / stats.total) * 100);

  function openMark() { setEditId(null); setForm(BLANK_FORM); setShowForm(true); }
  function openEdit(p: Person) {
    setEditId(p.id);
    setForm({ name: p.name, role: p.role, project: p.project, checkIn: p.checkIn === '--' ? '' : p.checkIn, status: p.status });
    setShowForm(true);
  }

  function handleSave() {
    if (!form.name.trim()) { notify('Please enter a name.'); return; }
    if (editId) {
      setPeople((prev) => prev.map((p) => p.id !== editId ? p : {
        ...p, ...form,
        checkIn: form.checkIn || '--',
        checkOut: p.checkOut,
      }));
      notify('Attendance updated.');
    } else {
      const now = new Date();
      const t = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
      setPeople((prev) => [...prev, {
        id: uid(), ...form, checkIn: form.status !== 'Absent' && form.status !== 'On Leave' ? t : '--',
        checkOut: '--', phone: '98400-99999',
      }]);
      notify('Attendance marked.');
    }
    setShowForm(false);
  }

  const roles    = ['All', 'Site Engineer', 'Contractor', 'Consultant', 'Vendor', 'Supervisor', 'Labour'];
  const projects = ['All', 'ABC Villa'];

  const roleBreakdown = (['Site Engineer','Contractor','Consultant','Vendor','Supervisor','Labour'] as Role[]).map((r) => ({
    role: r,
    present: people.filter((p) => p.role === r && p.status === 'Present').length,
    absent:  people.filter((p) => p.role === r && p.status === 'Absent').length,
    total:   people.filter((p) => p.role === r).length,
  }));

  return (
    <div className="space-y-5">

      {/* ── Toast ─────────────────────────────────────────── */}
      {notification && (
        <div className="fixed top-5 right-6 z-[999] px-4 py-2.5 rounded-xl bg-gray-900 text-white text-[13px] font-medium"
          style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
          {notification}
        </div>
      )}

      {/* ── Mark Attendance Modal ──────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden"
            style={{ boxShadow: '0 32px 64px rgba(0,0,0,0.25)' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-[15px] font-bold text-gray-900">{editId ? 'Edit Attendance' : 'Mark Attendance'}</h2>
              <button onClick={() => setShowForm(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <MField label="Name *">
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Kumar S" className="att-input" />
                </MField>
                <MField label="Check-In Time">
                  <input value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })}
                    placeholder="e.g. 09:00 AM" className="att-input" />
                </MField>
                <MField label="Role">
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                    className="att-select">
                    {roles.filter((r) => r !== 'All').map((r) => <option key={r}>{r}</option>)}
                  </select>
                </MField>
                <MField label="Project">
                  <select value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value as Project })}
                    className="att-select">
                    {projects.filter((p) => p !== 'All').map((p) => <option key={p}>{p}</option>)}
                  </select>
                </MField>
              </div>
              <MField label="Attendance Status">
                <div className="grid grid-cols-3 gap-1.5">
                  {(['Present','Late','Absent','On Leave','Half Day'] as AttStatus[]).map((s) => {
                    const c = STATUS_STYLE[s]; const active = form.status === s;
                    return (
                      <button key={s} onClick={() => setForm({ ...form, status: s })}
                        className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-[12px] font-medium transition-all"
                        style={{
                          background:  active ? c.bg    : '#f9fafb',
                          borderColor: active ? c.dot   : '#e5e7eb',
                          color:       active ? c.text  : '#6b7280',
                          fontWeight:  active ? '700'   : '500',
                        }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? c.dot : '#d1d5db' }} />
                        {s}
                      </button>
                    );
                  })}
                </div>
              </MField>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2.5">
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-[13px] font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave}
                className="px-5 py-2 rounded-lg bg-gray-900 text-white text-[13px] font-semibold hover:bg-gray-700">
                {editId ? 'Save Changes' : 'Mark Attendance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Attendance Management</h1>
          <p className="text-[13.5px] text-gray-500 mt-1">Monitor workforce availability and site attendance.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button onClick={() => notify('Exporting attendance report…')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export Report
          </button>
          <button onClick={() => notify('Attendance History: Feature coming soon')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            History
          </button>
          <button onClick={openMark}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-[13px] font-semibold hover:bg-gray-800 transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Mark Attendance
          </button>
        </div>
      </div>

      {/* ── Summary Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Present Today',   value: stats.present, sub: `of ${stats.total} expected`, bg: '#F0FDF4', border: '#BBF7D0', text: '#166534', bar: '#22C55E', pct: (stats.present/stats.total)*100 },
          { label: 'Absent Today',    value: stats.absent,  sub: 'Not on site',                bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', bar: '#EF4444', pct: (stats.absent/stats.total)*100  },
          { label: 'Late Arrivals',   value: stats.late,    sub: 'After 09:30 AM',             bg: '#FFF7ED', border: '#FED7AA', text: '#9A3412', bar: '#F97316', pct: (stats.late/stats.total)*100    },
          { label: 'Attendance Rate', value: `${rate}%`,   sub: 'Today vs target 95%',        bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF', bar: '#3B82F6', pct: rate                            },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border p-5"
            style={{ backgroundColor: c.bg, borderColor: c.border, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="text-[30px] font-extrabold leading-none" style={{ color: c.text }}>{c.value}</div>
            <div className="text-[12px] font-semibold mt-1.5 text-gray-700">{c.label}</div>
            <div className="text-[11px] text-gray-400 mt-0.5 mb-2.5">{c.sub}</div>
            <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(c.pct, 100)}%`, backgroundColor: c.bar }} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Project Workforce Summary ──────────────────────── */}
      <div className="grid grid-cols-5 gap-3">
        {PROJECT_SUMMARY.map((s) => {
          const pct = Math.round((s.present / s.expected) * 100);
          const c = PROJ_COLOR[s.project];
          const barColor = pct >= 90 ? '#22C55E' : pct >= 80 ? '#F97316' : '#EF4444';
          return (
            <div key={s.project} className="bg-white rounded-xl border border-gray-200 p-4"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div className="flex items-center gap-1.5 mb-3">
                <div className="w-2 h-2 rounded-full" style={{ background: c }} />
                <span className="text-[11.5px] font-bold text-gray-900 truncate">{s.project}</span>
              </div>
              <div className="flex items-end justify-between mb-1.5">
                <div>
                  <div className="text-[22px] font-extrabold leading-none" style={{ color: barColor }}>{s.present}</div>
                  <div className="text-[10.5px] text-gray-400 mt-0.5">of {s.expected}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-bold text-red-500">{s.absent} absent</div>
                  {s.late > 0 && <div className="text-[10.5px] text-orange-500">{s.late} late</div>}
                </div>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
              </div>
              <div className="text-[10px] text-gray-400 mt-1 text-right">{pct}% present</div>
            </div>
          );
        })}
      </div>

      {/* ── Main: table + charts ──────────────────────────── */}
      <div className="grid grid-cols-12 gap-5">

        {/* Attendance Table */}
        <div className="col-span-8 space-y-3">
          {/* Filter bar */}
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3 flex-wrap"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center gap-2 flex-1 min-w-[160px] bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or project…"
                className="flex-1 bg-transparent text-[12.5px] text-gray-700 placeholder-gray-400 outline-none" />
              {search && <button onClick={() => setSearch('')} className="text-gray-400 text-xs">✕</button>}
            </div>
            <select value={projectF} onChange={(e) => setProjectF(e.target.value)}
              className="text-[12.5px] text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none">
              {projects.map((p) => <option key={p}>{p === 'All' ? 'All Projects' : p}</option>)}
            </select>
            <select value={roleF} onChange={(e) => setRoleF(e.target.value)}
              className="text-[12.5px] text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none">
              {roles.map((r) => <option key={r}>{r === 'All' ? 'All Roles' : r}</option>)}
            </select>
            <select value={statusF} onChange={(e) => setStatusF(e.target.value)}
              className="text-[12.5px] text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none">
              <option value="All">All Statuses</option>
              {(['Present','Late','Absent','On Leave','Half Day'] as AttStatus[]).map((s) => <option key={s}>{s}</option>)}
            </select>
            <span className="text-[12px] text-gray-400 whitespace-nowrap">{filtered.length} records</span>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '1px solid #f3f4f6' }}>
                  {['Name & Role', 'Project', 'Check In', 'Check Out', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="py-10 text-center text-[13px] text-gray-400">No records found.</td></tr>
                ) : filtered.map((p) => {
                  const sc = STATUS_STYLE[p.status];
                  const rc = ROLE_COLOR[p.role];
                  return (
                    <tr key={p.id} className="group hover:bg-gray-50 transition-colors">
                      {/* Name & Role */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: rc.bg }}>
                            <span className="text-[10px] font-bold" style={{ color: rc.text }}>{initials(p.name)}</span>
                          </div>
                          <div>
                            <p className="text-[12.5px] font-bold text-gray-900">{p.name}</p>
                            <p className="text-[11px] text-gray-400">{p.role}</p>
                          </div>
                        </div>
                      </td>
                      {/* Project */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: PROJ_COLOR[p.project] }} />
                          <span className="text-[12px] text-gray-600 truncate max-w-[110px]">{p.project}</span>
                        </div>
                      </td>
                      {/* Check In */}
                      <td className="px-4 py-3">
                        <span className="text-[12.5px] font-mono font-semibold"
                          style={{ color: p.checkIn === '--' ? '#9ca3af' : '#111827' }}>
                          {p.checkIn}
                        </span>
                      </td>
                      {/* Check Out */}
                      <td className="px-4 py-3">
                        <span className="text-[12.5px] font-mono text-gray-400">{p.checkOut}</span>
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap"
                          style={{ background: sc.bg, color: sc.text, borderColor: sc.border }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc.dot }} />
                          {p.status}
                        </span>
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(p)}
                            className="px-2.5 py-1 rounded-lg text-[11.5px] font-medium bg-gray-100 hover:bg-gray-200 text-gray-600">Edit</button>
                          <button onClick={() => notify(`Calling ${p.name}…`)}
                            className="px-2.5 py-1 rounded-lg text-[11.5px] font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200">Call</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Right panel ──────────────────────────────────── */}
        <div className="col-span-4 space-y-4">

          {/* Chart tabs */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="flex border-b border-gray-100">
              {(['weekly','daily','trend'] as const).map((t) => (
                <button key={t} onClick={() => setActiveTab(t)}
                  className="flex-1 py-2.5 text-[11.5px] font-semibold capitalize transition-colors"
                  style={{ background: activeTab === t ? '#111111' : 'transparent', color: activeTab === t ? '#fff' : '#9ca3af' }}>
                  {t === 'weekly' ? 'Week' : t === 'daily' ? 'Today' : 'Trend'}
                </button>
              ))}
            </div>
            <div className="p-4">
              {activeTab === 'weekly' && (
                <>
                  <p className="text-[11.5px] font-bold text-gray-700 mb-3">Weekly Attendance (Mon–Today)</p>
                  <BarChart
                    data={[WEEKLY.map((w) => w.present), WEEKLY.map((w) => w.absent), WEEKLY.map((w) => w.late)]}
                    labels={WEEKLY.map((w) => w.day)}
                    colors={['#22C55E', '#EF4444', '#F97316']}
                  />
                  <div className="flex items-center gap-4 mt-2">
                    {[['#22C55E','Present'],['#EF4444','Absent'],['#F97316','Late']].map(([c,l]) => (
                      <div key={l} className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} />
                        <span className="text-[10.5px] text-gray-500">{l}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {activeTab === 'daily' && (
                <>
                  <p className="text-[11.5px] font-bold text-gray-700 mb-3">Today — By Role</p>
                  <div className="space-y-2.5">
                    {roleBreakdown.map((r) => {
                      const color = ROLE_COLOR[r.role].bg;
                      const pct = r.total ? Math.round((r.present / r.total) * 100) : 0;
                      return (
                        <div key={r.role}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                              <span className="text-[11.5px] font-medium text-gray-700">{r.role}</span>
                            </div>
                            <span className="text-[11px] text-gray-500">{r.present}/{r.total}</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-green-400" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              {activeTab === 'trend' && (
                <>
                  <p className="text-[11.5px] font-bold text-gray-700 mb-3">7-Day Attendance Rate (%)</p>
                  <LineChart data={DAILY_RATE} labels={['Mon','Tue','Wed','Thu','Fri','Sat','Today']} color="#22C55E" />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10.5px] text-gray-400">Target: 95%</span>
                    <span className="text-[11px] font-bold text-green-600">Avg: {Math.round(DAILY_RATE.reduce((a,b)=>a+b,0)/DAILY_RATE.length)}%</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Quick status counts */}
          <div className="bg-white rounded-xl border border-gray-200 p-5"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 className="text-[12.5px] font-bold text-gray-900 uppercase tracking-wider mb-3">Status Breakdown — Today</h3>
            {(['Present','Late','Absent','On Leave','Half Day'] as AttStatus[]).map((s) => {
              const count = people.filter((p) => p.status === s).length;
              const c = STATUS_STYLE[s];
              const pct = Math.round((count / people.length) * 100);
              return (
                <div key={s} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <span className="w-2 h-2 rounded-full" style={{ background: c.dot }} />
                  <span className="text-[12px] text-gray-600 flex-1">{s}</span>
                  <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.dot }} />
                  </div>
                  <span className="text-[12px] font-bold text-gray-700 w-5 text-right">{count}</span>
                </div>
              );
            })}
          </div>

          {/* Late / absent alert */}
          <div className="bg-white rounded-xl border border-red-200 overflow-hidden"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="px-4 py-3 border-b border-red-100 flex items-center justify-between bg-red-50">
              <h3 className="flex items-center gap-1.5 text-[12px] font-bold text-red-700 uppercase tracking-wider">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                Absent Today
              </h3>
              <span className="text-[11px] text-red-500">{stats.absent} not on site</span>
            </div>
            <div className="divide-y divide-red-50">
              {people.filter((p) => p.status === 'Absent').slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center gap-2.5 px-4 py-2.5">
                  <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-[9px] font-bold text-red-700">{initials(p.name)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-gray-800">{p.name}</p>
                    <p className="text-[10.5px] text-gray-400">{p.role} · {p.project}</p>
                  </div>
                  <button onClick={() => notify(`Calling ${p.name}…`)}
                    className="text-[10.5px] px-2 py-1 rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors whitespace-nowrap">
                    Call
                  </button>
                </div>
              ))}
              {stats.absent > 5 && (
                <div className="px-4 py-2.5 text-[11px] text-gray-400 text-center">+{stats.absent - 5} more absent</div>
              )}
            </div>
          </div>

        </div>
      </div>

      <style>{`
        .att-input { width:100%;padding:8px 12px;font-size:13px;color:#111827;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;outline:none; }
        .att-input:focus { border-color:#9ca3af;background:#fff; }
        .att-select { width:100%;padding:8px 12px;font-size:13px;color:#374151;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;outline:none; }
      `}</style>
    </div>
  );
}

function MField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
