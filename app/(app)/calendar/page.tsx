'use client';

import { useState, useMemo } from 'react';

/* ─── Types ───────────────────────────────────────────────────── */
type HolidayType = 'National Holiday' | 'Festival Holiday' | 'Regional Holiday' | 'Company Shutdown';

interface Holiday {
  id: string; date: string; /* YYYY-MM-DD */ name: string;
  type: HolidayType; createdBy: string;
}

/* ─── Config ──────────────────────────────────────────────────── */
const YEAR = 2026;

const TYPE_STYLE: Record<HolidayType, { bg: string; text: string; border: string; dot: string }> = {
  'National Holiday':  { bg: '#FFF7ED', text: '#9A3412', border: '#FED7AA', dot: '#EA580C' },
  'Festival Holiday':  { bg: '#FAF5FF', text: '#6D28D9', border: '#DDD6FE', dot: '#8B5CF6' },
  'Regional Holiday':  { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0', dot: '#22C55E' },
  'Company Shutdown':  { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA', dot: '#EF4444' },
};

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const DAYS_SHORT = ['Su','Mo','Tu','We','Th','Fr','Sa'];

/* ─── Seed holidays ───────────────────────────────────────────── */
const SEED_HOLIDAYS: Holiday[] = [
  { id: 'h01', date: '2026-01-01', name: 'New Year Holiday',       type: 'National Holiday',  createdBy: 'Admin' },
  { id: 'h02', date: '2026-01-14', name: 'Pongal',                 type: 'Festival Holiday',  createdBy: 'Admin' },
  { id: 'h03', date: '2026-01-15', name: 'Thiruvalluvar Day',      type: 'Regional Holiday',  createdBy: 'Admin' },
  { id: 'h04', date: '2026-01-16', name: 'Uzhavar Thirunal',       type: 'Regional Holiday',  createdBy: 'Admin' },
  { id: 'h05', date: '2026-01-26', name: 'Republic Day',           type: 'National Holiday',  createdBy: 'Admin' },
  { id: 'h06', date: '2026-03-29', name: 'Good Sunday',            type: 'Festival Holiday',  createdBy: 'Admin' },
  { id: 'h07', date: '2026-04-14', name: 'Tamil New Year',         type: 'Festival Holiday',  createdBy: 'Admin' },
  { id: 'h08', date: '2026-04-14', name: 'Dr. Ambedkar Jayanti',   type: 'National Holiday',  createdBy: 'Admin' },
  { id: 'h09', date: '2026-05-01', name: 'May Day',                type: 'National Holiday',  createdBy: 'Admin' },
  { id: 'h10', date: '2026-06-15', name: 'Company Annual Closure', type: 'Company Shutdown',  createdBy: 'Admin' },
  { id: 'h11', date: '2026-08-15', name: 'Independence Day',       type: 'National Holiday',  createdBy: 'Admin' },
  { id: 'h12', date: '2026-09-02', name: 'Vinayagar Chaturthi',    type: 'Festival Holiday',  createdBy: 'Admin' },
  { id: 'h13', date: '2026-10-02', name: 'Gandhi Jayanti',         type: 'National Holiday',  createdBy: 'Admin' },
  { id: 'h14', date: '2026-10-24', name: 'Diwali',                 type: 'Festival Holiday',  createdBy: 'Admin' },
  { id: 'h15', date: '2026-10-25', name: 'Diwali Holiday',         type: 'Festival Holiday',  createdBy: 'Admin' },
  { id: 'h16', date: '2026-11-10', name: 'Muharram',               type: 'Festival Holiday',  createdBy: 'Admin' },
  { id: 'h17', date: '2026-12-25', name: 'Christmas',              type: 'Festival Holiday',  createdBy: 'Admin' },
  { id: 'h18', date: '2026-12-31', name: 'Year End Closure',       type: 'Company Shutdown',  createdBy: 'Admin' },
];

let nextId = 100;
function uid() { return `h${++nextId}`; }

/* ─── Date helpers ────────────────────────────────────────────── */
function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function firstDay(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}
function isSunday(year: number, month: number, day: number) {
  return new Date(year, month, day).getDay() === 0;
}
function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function formatDisplay(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
}
function countSundaysInYear(year: number) {
  let count = 0;
  for (let m = 0; m < 12; m++) {
    const dim = daysInMonth(year, m);
    for (let d = 1; d <= dim; d++) if (isSunday(year, m, d)) count++;
  }
  return count;
}

const BLANK_FORM = { name: '', date: '', type: 'National Holiday' as HolidayType };

/* ─── Page ───────────────────────────────────────────────────── */
export default function HolidayCalendarPage() {
  const [holidays,      setHolidays]      = useState<Holiday[]>(SEED_HOLIDAYS);
  const [view,          setView]          = useState<'year' | 'list'>('year');
  const [search,        setSearch]        = useState('');
  const [typeFilter,    setTypeFilter]    = useState('All');
  const [showForm,      setShowForm]      = useState(false);
  const [editId,        setEditId]        = useState<string | null>(null);
  const [form,          setForm]          = useState(BLANK_FORM);
  const [notification,  setNotification]  = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  function notify(msg: string) { setNotification(msg); setTimeout(() => setNotification(''), 2500); }

  const holidayMap = useMemo(() => {
    const map: Record<string, Holiday[]> = {};
    holidays.forEach((h) => { (map[h.date] ??= []).push(h); });
    return map;
  }, [holidays]);

  const sundayCount = useMemo(() => countSundaysInYear(YEAR), []);

  const workingDays = useMemo(() => {
    let total = 0;
    const hDates = new Set(holidays.map((h) => h.date));
    for (let m = 0; m < 12; m++) {
      const dim = daysInMonth(YEAR, m);
      for (let d = 1; d <= dim; d++) {
        if (!isSunday(YEAR, m, d) && !hDates.has(toDateStr(YEAR, m, d))) total++;
      }
    }
    return total;
  }, [holidays]);

  const filtered = useMemo(() =>
    holidays
      .filter((h) => typeFilter === 'All' || h.type === typeFilter)
      .filter((h) => !search || h.name.toLowerCase().includes(search.toLowerCase()) || h.date.includes(search))
      .sort((a, b) => a.date.localeCompare(b.date)),
  [holidays, typeFilter, search]);

  function openAdd(prefillDate = '') {
    setEditId(null);
    setForm({ ...BLANK_FORM, date: prefillDate });
    setShowForm(true);
  }
  function openEdit(h: Holiday) {
    setEditId(h.id);
    setForm({ name: h.name, date: h.date, type: h.type });
    setShowForm(true);
  }
  function handleSave() {
    if (!form.name.trim() || !form.date) { notify('Please fill in all fields.'); return; }
    if (editId) {
      setHolidays((prev) => prev.map((h) => h.id === editId ? { ...h, ...form } : h));
      notify('Holiday updated.');
    } else {
      setHolidays((prev) => [...prev, { id: uid(), ...form, createdBy: 'Admin' }]);
      notify('Holiday added.');
    }
    setShowForm(false);
  }
  function handleDelete(id: string) {
    setHolidays((prev) => prev.filter((h) => h.id !== id));
    setDeleteConfirm(null);
    notify('Holiday deleted.');
  }

  return (
    <div className="space-y-5">

      {/* ── Toast ─────────────────────────────────────────── */}
      {notification && (
        <div className="fixed top-5 right-6 z-[999] px-4 py-2.5 rounded-xl bg-gray-900 text-white text-[13px] font-medium"
          style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
          {notification}
        </div>
      )}

      {/* ── Delete confirm ─────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6"
            style={{ boxShadow: '0 32px 64px rgba(0,0,0,0.25)' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </div>
            <h3 className="text-[15px] font-bold text-gray-900 text-center mb-1">Delete Holiday?</h3>
            <p className="text-[12.5px] text-gray-500 text-center mb-5">This will affect project schedules.</p>
            <div className="flex gap-2.5">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-[13px] font-medium text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white text-[13px] font-semibold hover:bg-red-700">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal ───────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden"
            style={{ boxShadow: '0 32px 64px rgba(0,0,0,0.25)' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-[15px] font-bold text-gray-900">{editId ? 'Edit Holiday' : 'Add Holiday'}</h2>
                <p className="text-[11.5px] text-gray-400 mt-0.5">Changes affect all project schedules.</p>
              </div>
              <button onClick={() => setShowForm(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Holiday Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Diwali, Independence Day" className="cal-input" />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Date *</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                  min={`${YEAR}-01-01`} max={`${YEAR}-12-31`} className="cal-input" />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-gray-700 mb-2">Holiday Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(TYPE_STYLE) as HolidayType[]).map((t) => {
                    const s = TYPE_STYLE[t]; const active = form.type === t;
                    return (
                      <button key={t} onClick={() => setForm({ ...form, type: t })}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border text-[12px] text-left transition-all"
                        style={{
                          background:  active ? s.bg    : '#f9fafb',
                          borderColor: active ? s.dot   : '#e5e7eb',
                          color:       active ? s.text  : '#6b7280',
                          fontWeight:  active ? '700'   : '500',
                        }}>
                        <span className="w-2 h-2 rounded-full" style={{ background: active ? s.dot : '#d1d5db' }} />
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2.5">
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-[13px] font-medium text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleSave}
                className="px-5 py-2 rounded-lg bg-gray-900 text-white text-[13px] font-semibold hover:bg-gray-700">
                {editId ? 'Save Changes' : 'Add Holiday'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Holiday Calendar</h1>
          <p className="text-[13.5px] text-gray-500 mt-1">Configure holidays and working schedule for ABC Villa Construction.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            {(['year', 'list'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className="px-4 py-2 text-[12.5px] font-medium transition-colors"
                style={{ background: view === v ? '#111111' : 'transparent', color: view === v ? '#fff' : '#6b7280' }}>
                {v === 'year' ? 'Year View' : 'Holiday List'}
              </button>
            ))}
          </div>
          <button onClick={() => openAdd()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-[13px] font-semibold hover:bg-gray-800 transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Holiday
          </button>
        </div>
      </div>

      {/* ── Summary Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Holidays',          value: holidays.length + sundayCount, sub: 'Sundays + custom',               bg: '#FEF2F2', border: '#FECACA', text: '#991B1B' },
          { label: 'Working Days This Year',  value: workingDays,                   sub: `Excl. ${holidays.length} custom`, bg: '#F0FDF4', border: '#BBF7D0', text: '#166534' },
          { label: 'Sundays Auto-Blocked',    value: sundayCount,                   sub: 'Every Sunday in 2026',            bg: '#FEF2F2', border: '#FCA5A5', text: '#DC2626' },
          { label: 'Custom Holidays Added',   value: holidays.length,               sub: 'National, Festival, etc.',        bg: '#FFF7ED', border: '#FED7AA', text: '#9A3412' },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border p-5"
            style={{ backgroundColor: c.bg, borderColor: c.border, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="text-[28px] font-extrabold leading-none" style={{ color: c.text }}>{c.value}</div>
            <div className="text-[12px] font-semibold mt-1.5" style={{ color: '#374151' }}>{c.label}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Legend ────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center gap-5 flex-wrap"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Legend</span>
        {[
          { color: '#DC2626', bg: '#FEF2F2', label: 'Sunday (Auto-blocked)' },
          { color: '#EA580C', bg: '#FFF7ED', label: 'National Holiday' },
          { color: '#8B5CF6', bg: '#FAF5FF', label: 'Festival Holiday' },
          { color: '#22C55E', bg: '#F0FDF4', label: 'Regional Holiday' },
          { color: '#EF4444', bg: '#FEF2F2', label: 'Company Shutdown' },
          { color: '#374151', bg: '#F9FAFB', label: 'Working Day' },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded" style={{ background: l.bg, border: `1.5px solid ${l.color}` }} />
            <span className="text-[11.5px] text-gray-600">{l.label}</span>
          </div>
        ))}
        <span className="ml-auto text-[11px] text-gray-400">Click any non-Sunday day to add a holiday</span>
      </div>

      {/* ── Year View — 4×3 month grid ────────────────────── */}
      {view === 'year' && (
        <div className="grid grid-cols-4 gap-4">
          {MONTHS.map((name, m) => (
            <MiniMonth key={m} year={YEAR} month={m} name={name}
              holidayMap={holidayMap}
              onDayClick={(d) => {
                if (!isSunday(YEAR, m, d)) openAdd(toDateStr(YEAR, m, d));
              }} />
          ))}
        </div>
      )}

      {/* ── Holiday List View ─────────────────────────────── */}
      {view === 'list' && (
        <div className="grid grid-cols-12 gap-5">
          {/* Table */}
          <div className="col-span-8 space-y-3">
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3 flex-wrap"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div className="flex items-center gap-2 flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search holidays by name or date…"
                  className="flex-1 bg-transparent text-[12.5px] text-gray-700 placeholder-gray-400 outline-none" />
                {search && <button onClick={() => setSearch('')} className="text-gray-400 text-xs">✕</button>}
              </div>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
                className="text-[12.5px] text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none">
                <option value="All">All Types</option>
                {(Object.keys(TYPE_STYLE) as HolidayType[]).map((t) => <option key={t}>{t}</option>)}
              </select>
              <span className="text-[12px] text-gray-400 whitespace-nowrap">{filtered.length} holidays</span>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <table className="w-full">
                <thead>
                  <tr style={{ background: '#fafafa', borderBottom: '1px solid #f3f4f6' }}>
                    {['Holiday Name', 'Date', 'Day', 'Type', 'Created By', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} className="py-12 text-center text-[13px] text-gray-400">No holidays found.</td></tr>
                  ) : filtered.map((h) => {
                    const s = TYPE_STYLE[h.type];
                    const [, mo, d] = h.date.split('-').map(Number);
                    const dow = new Date(YEAR, mo - 1, d).getDay();
                    const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dow];
                    return (
                      <tr key={h.id} className="group hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {dayName === 'Sun' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />}
                            <span className="text-[13px] font-semibold text-gray-900">{h.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[12.5px] font-mono text-gray-600">{formatDisplay(h.date)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: dayName === 'Sun' ? '#FEF2F2' : '#F9FAFB', color: dayName === 'Sun' ? '#DC2626' : '#374151' }}>
                            {dayName}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border"
                            style={{ background: s.bg, color: s.text, borderColor: s.border }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
                            {h.type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-gray-900 flex items-center justify-center">
                              <span className="text-[7px] font-bold text-white">{h.createdBy.slice(0, 2).toUpperCase()}</span>
                            </div>
                            <span className="text-[12px] text-gray-600">{h.createdBy}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(h)}
                              className="px-2.5 py-1 rounded-lg text-[11.5px] font-medium bg-gray-100 hover:bg-gray-200 text-gray-600">Edit</button>
                            <button onClick={() => setDeleteConfirm(h.id)}
                              className="px-2.5 py-1 rounded-lg text-[11.5px] font-medium bg-red-50 hover:bg-red-100 text-red-600 border border-red-200">Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right stats panel */}
          <div className="col-span-4 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <h3 className="text-[12.5px] font-bold text-gray-900 uppercase tracking-wider mb-4">Monthly Breakdown</h3>
              {MONTHS.map((mn, mi) => {
                const mHols = holidays.filter((h) => h.date.startsWith(`${YEAR}-${String(mi + 1).padStart(2, '0')}`)).length;
                const dim = daysInMonth(YEAR, mi);
                const suns = Array.from({ length: dim }, (_, i) => i + 1).filter((d) => isSunday(YEAR, mi, d)).length;
                const work = dim - suns - mHols;
                return (
                  <div key={mn} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-[11.5px] font-semibold text-gray-500 w-7">{mn.slice(0, 3)}</span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-400 rounded-full" style={{ width: `${(work / dim) * 100}%` }} />
                    </div>
                    <span className="text-[10.5px] text-gray-400 tabular-nums w-20 text-right">
                      {work}w · {suns + mHols}h
                    </span>
                  </div>
                );
              })}
              <p className="text-[10px] text-gray-400 mt-2">w = working · h = holidays</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <h3 className="text-[12.5px] font-bold text-gray-900 uppercase tracking-wider mb-3">By Type</h3>
              {(Object.keys(TYPE_STYLE) as HolidayType[]).map((t) => {
                const count = holidays.filter((h) => h.type === t).length;
                const s = TYPE_STYLE[t];
                return (
                  <div key={t} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <span className="w-2 h-2 rounded-full" style={{ background: s.dot }} />
                    <span className="text-[12px] text-gray-600 flex-1">{t}</span>
                    <span className="text-[12px] font-bold text-gray-700 w-5 text-right">{count}</span>
                  </div>
                );
              })}
              <div className="flex items-center gap-3 py-2 mt-1 border-t border-gray-100">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-[12px] text-gray-600 flex-1">Sunday (Auto-blocked)</span>
                <span className="text-[12px] font-bold text-gray-700 w-5 text-right">{sundayCount}</span>
              </div>
            </div>

            <div className="bg-gray-900 rounded-xl p-5 text-white">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">Business Rules</h3>
              {[
                'Every Sunday is automatically blocked as a non-working day.',
                'Custom holidays affect project deadlines and task scheduling.',
                'Only Admins can add, edit, or remove holidays.',
                'Company shutdown days block all project activities.',
              ].map((r, i) => (
                <div key={i} className="flex items-start gap-2 mb-2.5 last:mb-0">
                  <span className="w-1 h-1 rounded-full bg-gray-500 flex-shrink-0 mt-1.5" />
                  <p className="text-[11.5px] text-gray-300 leading-snug">{r}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .cal-input {
          width:100%; padding:8px 12px; font-size:13px; color:#111827;
          background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; outline:none;
          transition:border-color .15s;
        }
        .cal-input:focus { border-color:#9ca3af; background:#fff; }
      `}</style>
    </div>
  );
}

/* ─── Mini Month ─────────────────────────────────────────────── */
function MiniMonth({ year, month, name, holidayMap, onDayClick }: {
  year: number; month: number; name: string;
  holidayMap: Record<string, Holiday[]>;
  onDayClick: (day: number) => void;
}) {
  const dim   = daysInMonth(year, month);
  const start = firstDay(year, month);
  const cells = Array.from({ length: start + dim }, (_, i) => i < start ? null : i - start + 1);
  const sunCount  = Array.from({ length: dim }, (_, i) => i + 1).filter((d) => isSunday(year, month, d)).length;
  const mHolCount = Object.keys(holidayMap).filter((k) => k.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).length;
  const work      = dim - sunCount - mHolCount;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
        <span className="text-[12.5px] font-bold text-gray-900">{name}</span>
        <span className="text-[10px] text-gray-400 font-mono">{year}</span>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 px-1.5 pt-1.5">
        {DAYS_SHORT.map((d) => (
          <div key={d} className="text-center text-[9px] font-bold pb-1"
            style={{ color: d === 'Su' ? '#DC2626' : '#9CA3AF' }}>{d}</div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7 px-1.5 pb-1.5 gap-y-0.5">
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} />;
          const ds       = toDateStr(year, month, day);
          const sun      = isSunday(year, month, day);
          const holList  = holidayMap[ds] ?? [];
          const isToday  = ds === '2026-06-22';

          let bg = 'transparent', txt = '#374151', bdr = 'transparent';
          if (sun) { bg = '#FEF2F2'; txt = '#DC2626'; }
          else if (holList.length > 0) {
            const t = holList[0].type;
            if (t === 'Company Shutdown')     { bg = '#FEF2F2'; txt = '#991B1B'; }
            else if (t === 'National Holiday'){ bg = '#FFF7ED'; txt = '#9A3412'; }
            else if (t === 'Festival Holiday'){ bg = '#FAF5FF'; txt = '#6D28D9'; }
            else                              { bg = '#F0FDF4'; txt = '#166534'; }
          }
          if (isToday) bdr = '#111111';

          return (
            <button key={`day-${idx}`}
              onClick={() => onDayClick(day)}
              title={sun ? 'Sunday' : holList.map((h) => h.name).join(', ') || 'Click to add holiday'}
              className="relative flex items-center justify-center rounded text-[10px] font-semibold transition-colors"
              style={{ height: '22px', background: bg, color: txt, border: `1.5px solid ${bdr}`, cursor: sun ? 'default' : 'pointer' }}>
              {day}
              {holList.length > 0 && !sun && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ background: txt }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-green-600">{work}w</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[9.5px] text-red-500">{sunCount}S</span>
          {mHolCount > 0 && <span className="text-[9.5px] text-orange-500">{mHolCount}h</span>}
        </div>
      </div>
    </div>
  );
}
