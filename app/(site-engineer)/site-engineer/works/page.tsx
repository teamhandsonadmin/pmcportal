'use client';

import { useState, useMemo } from 'react';

/* ── Types ──────────────────────────────────────────────────── */
type ColId = 'Not Started' | 'In Progress' | 'Pending Review' | 'Completed';

interface TaskItem {
  id: string; seq: number; name: string;
  status: ColId; pct: number; comments: number; photos: number;
  catCode: string; catName: string; accent: string; tagBg: string; tagText: string;
}

/* ── Category definitions ───────────────────────────────────── */
const CAT_LIST = [
  { name:'HVAC', code:'HVAC', accent:'#3B82F6', tagBg:'#EFF6FF', tagText:'#1D4ED8',
    tasks:['AC Units Level Marking','HVAC Support Framing Works','HVAC Refrigerant Piping','Wall Chipping For HVAC Drain Outlet Pipe','HVAC Drain Outlet Pipe Routing','HVAC Drain Pipe Plastering'] },
  { name:'Electrical', code:'ELEC', accent:'#F59E0B', tagBg:'#FFFBEB', tagText:'#B45309',
    tasks:['Ceiling Electrical Conduit Marking','Ceiling Electrical Conduit Frame Works','Switch Board Level Marking','Wall Electrical Conduit Chipping','Wall Electrical Conduit & Back Box Fixing','Ceiling & Wall Electrical Wiring','Electrical Switch Boards & Wall Conduits Plastering','External Electrical Works','Non-Electrical Floor Conduit And Wiring Works','Ceiling Down Lights Fixing','Electrical Switch Boards Fixing','Ceiling Fans And Exhaust Fans Fixing','Wardrobe Profile Lights Fixing'] },
  { name:'Plumbing', code:'PLUM', accent:'#06B6D4', tagBg:'#ECFEFF', tagText:'#0E7490',
    tasks:['CPVC & PVC Pipe Level Marking','Suspended Ceiling Framing For PVC & CPVC','Sanitary & Kitchen Fittings Level Marking','Wall Chipping For CPVC/PVC Pipes','Plumbing CPVC & PVC Pipe Routing','Water Pressure Testing','WC Flush Tanks And Concealed Parts Fixing','Toilet Plumbing Pipes, Ledge Wall Masonry & Plastering','External Plumbing Works','Swimming Pool Plumbing Works','Sanitary Fittings Fixing'] },
  { name:'Civil Works', code:'CIVIL', accent:'#6B7280', tagBg:'#F9FAFB', tagText:'#374151',
    tasks:['Door & Window Opening Corrections & Plastering','Terrace/Balcony Debris Cleaning','Electrical Switch Board Plastering','Swimming Pool Civil Changes','Swimming Pool Debris Cleaning','Swimming Pool Masonry Packing & Plastering','Sunken Filling','Toilet Floor Tile Laying','Terrace/Balcony Waterproofing','Terrace/Balcony Sunken Slab Water Pond Test'] },
  { name:'Flooring', code:'FLOOR', accent:'#F97316', tagBg:'#FFF7ED', tagText:'#C2410C',
    tasks:['Tile Bull Marking','Window Stone Jambing Works','Internal Marble Flooring','Marble Polishing','Marble Floor Protection Sheets Laying','Kitchen Counter Stone Laying','Toilet Vanity Counter Stone Laying','Toilet Floor Tiling & Dado Works','Swimming Pool Wall Tiling & Dado Works','External Flooring'] },
  { name:'False Ceiling', code:'F.CEIL', accent:'#A855F7', tagBg:'#FAF5FF', tagText:'#7E22CE',
    tasks:['Gypsum & Wooden False Ceiling Level Marking','GI & Wood Framing Works','Gypsum Ceiling Sheeting','Ceiling Cuttings For Lights','Gypsum Ceiling Joint Finishing','Putty Coating For Gypsum Ceiling','Sanding And Primer For Gypsum Ceiling'] },
  { name:'Carpentry', code:'CARPNTR', accent:'#D97706', tagBg:'#FFFBEB', tagText:'#92400E',
    tasks:['Wooden Supports For Curtain Pelmets','Main Door & Internal Door Measurements','Main Door & Internal Door Erection','Wooden Ceiling Cutouts For Lights','Fluted Panels / Veneer Fixing','Wooden Wall Panelling','Curtain Pelmet Fixing'] },
  { name:'POP Works', code:'POP', accent:'#EC4899', tagBg:'#FDF2F8', tagText:'#BE185D',
    tasks:['Wall Bull Marks','Wall Hacking Works','Wall Punning Works'] },
  { name:'Painting', code:'PAINT', accent:'#EF4444', tagBg:'#FEF2F2', tagText:'#B91C1C',
    tasks:['External Painting','Putty 2 Coats (Internal / External)','Sanding','Base Primer','First Coat Paint','Second Coat Paint','Texture Paint','Main Gate Painting'] },
  { name:'Aluminium D&W', code:'ALU', accent:'#64748B', tagBg:'#F8FAFC', tagText:'#334155',
    tasks:['Measurements','Sliding Door Erection'] },
  { name:'Glass Works', code:'GLASS', accent:'#38BDF8', tagBg:'#F0F9FF', tagText:'#0369A1',
    tasks:['Mirror & Shower Partition Measurements','Mirror & Shower Partition Fixing'] },
  { name:'Modular Works', code:'MODULAR', accent:'#22C55E', tagBg:'#F0FDF4', tagText:'#15803D',
    tasks:['Site Measurements For Kitchen, Wardrobes & Vanity','Modular Unit Erection','Wardrobe Installation','Kitchen Installation','Vanity Installation'] },
  { name:'Fabrication', code:'FABRI', accent:'#DC2626', tagBg:'#FEF2F2', tagText:'#991B1B',
    tasks:['MS Stair Case Works','Terrace Pergola Works','Main Gate & Wicket Gate Fabrication'] },
  { name:'Waterproofing', code:'W.PROOF', accent:'#14B8A6', tagBg:'#F0FDFA', tagText:'#0F766E',
    tasks:['Terrace / Balcony / Planter Box Waterproofing','Toilet Sunken Slab Water Pond Test','Swimming Pool Waterproofing'] },
  { name:'Lighting', code:'LIGHT', accent:'#EAB308', tagBg:'#FEFCE8', tagText:'#A16207',
    tasks:['Decorative Lights Fixing'] },
  { name:'Landscape', code:'LSCAPE', accent:'#10B981', tagBg:'#ECFDF5', tagText:'#065F46',
    tasks:['Drainage Medium Installation','Soil Filling','Plantation Works'] },
];

/* ── Build flat task list ───────────────────────────────────── */
let _s = 0;
const ALL_TASKS: TaskItem[] = CAT_LIST.flatMap((cat) =>
  cat.tasks.map((name) => {
    const i = _s++;
    const r = i % 11;
    const status: ColId = r < 2 ? 'Completed' : r < 5 ? 'In Progress' : r < 7 ? 'Pending Review' : 'Not Started';
    const pct = status === 'Completed' ? 100 : status === 'In Progress' ? 30 + (i % 6) * 10 : status === 'Pending Review' ? 75 + (i % 3) * 8 : 0;
    return {
      id: `TASK-${String(i + 1).padStart(3, '0')}`, seq: i + 1, name, status, pct,
      comments: i % 4, photos: i % 5,
      catCode: cat.code, catName: cat.name, accent: cat.accent, tagBg: cat.tagBg, tagText: cat.tagText,
    };
  })
);

/* ── Status chip style ──────────────────────────────────────── */
const STATUS_STYLE: Record<ColId, { bg: string; text: string }> = {
  'Completed':      { bg: '#F0FDF4', text: '#166534' },
  'In Progress':    { bg: '#EFF6FF', text: '#1D4ED8' },
  'Pending Review': { bg: '#FFFBEB', text: '#B45309' },
  'Not Started':    { bg: '#F9FAFB', text: '#6B7280' },
};

/* ── Summary counts ─────────────────────────────────────────── */
const SUMMARY = ALL_TASKS.reduce(
  (acc, t) => { acc[t.status]++; return acc; },
  { 'Completed': 0, 'In Progress': 0, 'Pending Review': 0, 'Not Started': 0 } as Record<ColId, number>
);

/* ── SVG Icons ──────────────────────────────────────────────── */
function IconSearch() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}
function IconChevron({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.2"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
      <path d="M6 9l6 6 6-6"/>
    </svg>
  );
}
function IconClose() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}
function IconCamera() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  );
}
function IconComment() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  );
}

/* ── Toast ──────────────────────────────────────────────────── */
function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  return (
    <div
      className="fixed bottom-6 left-1/2 z-[60] flex items-center gap-2.5 bg-gray-900 text-white text-[12.5px] font-semibold px-4 py-2.5 rounded-xl shadow-lg"
      style={{ transform: 'translateX(-50%)' }}
      onAnimationEnd={onDone}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6EE7B7" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 14 14"/>
      </svg>
      {msg}
    </div>
  );
}

/* ── Dep Status Dot ─────────────────────────────────────────── */
const DEP_ITEMS = [
  { label: 'Architect: Drawing Approved',    done: true  },
  { label: 'Consultant: Technical Review',   done: false },
  { label: 'Client: Budget Approval',        done: true  },
  { label: 'Site Engineer: Site Ready',      done: false },
  { label: 'Contractor: Material Available', done: false },
];

/* ── Task Drawer ────────────────────────────────────────────── */
function TaskDrawer({ task, onClose, onToast }: {
  task: TaskItem; onClose: () => void; onToast: (m: string) => void;
}) {
  const [progress, setProgress] = useState(task.pct);
  const [comment,  setComment]  = useState('');
  const ss = STATUS_STYLE[task.status];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/10" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex flex-col bg-white border-l border-gray-200 w-[520px]"
        style={{ boxShadow: '-8px 0 32px rgba(0,0,0,0.08)' }}>

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10.5px] font-mono font-bold text-gray-400">{task.id}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                style={{ background: task.tagBg, color: task.tagText }}>{task.catCode}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                style={{ background: ss.bg, color: ss.text }}>{task.status}</span>
            </div>
            <h2 className="text-[15px] font-bold text-gray-900 leading-snug">{task.name}</h2>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors flex-shrink-0">
            <IconClose />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* Status & Progress */}
          <div className="px-6 py-4 border-b border-gray-50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">Status & Progress</p>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11.5px] font-bold px-2.5 py-1 rounded-lg" style={{ background: ss.bg, color: ss.text }}>{task.status}</span>
              <span className="text-[13px] font-black text-gray-900 tabular-nums">{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: '#111' }} />
            </div>
          </div>

          {/* Details */}
          <div className="px-6 py-4 border-b border-gray-50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">Details</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { l: 'Due Date',   v: '10 Jul 2026' },
                { l: 'Start Date', v: '1 Jun 2026'  },
                { l: 'Assignee',   v: 'Kumar S'     },
              ].map((f) => (
                <div key={f.l} className="rounded-xl bg-gray-50 px-3.5 py-2.5">
                  <p className="text-[9.5px] font-bold uppercase tracking-wider text-gray-400 mb-1">{f.l}</p>
                  <p className="text-[12px] font-semibold text-gray-800">{f.v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Dependencies */}
          <div className="px-6 py-4 border-b border-gray-50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">Dependencies</p>
            <div className="space-y-2">
              {DEP_ITEMS.map((dep) => (
                <div key={dep.label} className="flex items-center gap-2.5 py-1">
                  <div className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: dep.done ? '#22C55E' : '#D1D5DB' }} />
                  <span className="text-[12px] text-gray-600">{dep.label}</span>
                  {dep.done && (
                    <span className="ml-auto text-[9.5px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded-md">Done</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 py-4 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">Actions</p>

            {/* Upload Photos */}
            <button
              onClick={() => onToast('Photo upload coming soon')}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-blue-200 text-blue-700 text-[12.5px] font-semibold hover:bg-blue-50 transition-colors">
              <IconCamera />
              Upload Photos
            </button>

            {/* Update Progress */}
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-[11px] font-bold text-gray-600 mb-2">Update Progress — {progress}%</p>
              <input type="range" min={0} max={100} value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                className="w-full accent-gray-900" />
            </div>

            {/* Add Comment */}
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment…"
                rows={3}
                className="w-full px-4 py-3 text-[12.5px] text-gray-700 placeholder-gray-400 outline-none resize-none bg-white border-b border-gray-100"
              />
              <div className="px-4 py-2.5 bg-gray-50 flex justify-end">
                <button
                  onClick={() => { if (comment.trim()) { onToast('Comment added'); setComment(''); } }}
                  className="text-[11.5px] font-bold px-3.5 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors">
                  Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Task Card ──────────────────────────────────────────────── */
function TaskCard({ task, onView, onToast }: {
  task: TaskItem; onView: () => void; onToast: (m: string) => void;
}) {
  const ss = STATUS_STYLE[task.status];
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-1.5 mb-2">
        <span className="text-[10px] font-mono text-gray-400">{task.id}</span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ background: ss.bg, color: ss.text }}>{task.status}</span>
      </div>

      {/* Name */}
      <p className="text-[13px] font-semibold text-gray-900 leading-snug mb-3"
        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {task.name}
      </p>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-gray-100 mb-1.5 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${task.pct}%`, background: '#111' }} />
      </div>
      <p className="text-[11px] text-gray-500 tabular-nums mb-2">{task.pct}% complete</p>

      {/* Comments + photos */}
      <div className="flex items-center gap-3 mb-3">
        <span className="flex items-center gap-1 text-[11px] text-gray-400">
          <IconComment />
          {task.comments} {task.comments === 1 ? 'comment' : 'comments'}
        </span>
        <span className="flex items-center gap-1 text-[11px] text-gray-400">
          <IconCamera />
          {task.photos} {task.photos === 1 ? 'photo' : 'photos'}
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 flex-wrap">
        {[
          { label: 'View Task',        action: onView                                    },
          { label: 'Upload Photos',    action: () => onToast('Photo upload coming soon') },
          { label: 'Update Progress',  action: onView                                    },
          { label: 'Add Comments',     action: onView                                    },
          { label: 'View Deps',        action: onView                                    },
        ].map(({ label, action }) => (
          <button key={label} onClick={action}
            className="text-[10.5px] font-semibold px-2 py-1 rounded-lg border border-gray-200 text-gray-600 bg-white hover:border-gray-400 hover:text-gray-900 transition-colors">
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Category Accordion ─────────────────────────────────────── */
function CategoryAccordion({ cat, tasks, open, onToggle, onViewTask, onToast }: {
  cat: typeof CAT_LIST[0];
  tasks: TaskItem[];
  open: boolean;
  onToggle: () => void;
  onViewTask: (task: TaskItem) => void;
  onToast: (m: string) => void;
}) {
  const completedCount = tasks.filter((t) => t.status === 'Completed').length;
  const completionPct  = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>

      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left"
        style={{ background: open ? '#FAFAFA' : 'white' }}>

        {/* Left: dot + name + count */}
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cat.accent }} />
        <span className="text-[14px] font-bold text-gray-900">{cat.name}</span>
        <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">
          {tasks.length} tasks
        </span>

        {/* Right: progress bar + % + chevron */}
        <div className="flex items-center gap-2.5 ml-auto">
          <span className="text-[11px] font-bold text-gray-700 tabular-nums">{completionPct}%</span>
          <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${completionPct}%`, background: completionPct === 100 ? '#22C55E' : cat.accent }} />
          </div>
          <IconChevron open={open} />
        </div>
      </button>

      {/* Expanded task grid */}
      {open && (
        <div className="p-4 grid grid-cols-4 gap-3">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onView={() => onViewTask(task)}
              onToast={onToast}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────── */
export default function SiteEngineerWorksPage() {
  const [search,      setSearch]    = useState('');
  const [openCats,    setOpenCats]  = useState<Set<string>>(new Set(['HVAC']));
  const [selectedTask, setSelected] = useState<TaskItem | null>(null);
  const [toastMsg,    setToastMsg]  = useState<string | null>(null);

  /* Show toast for 2 s */
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2000);
  };

  /* Toggle accordion */
  const toggleCat = (code: string) => {
    setOpenCats((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };

  /* Build per-category task lists */
  const tasksByCat = useMemo(() => {
    const map: Record<string, TaskItem[]> = {};
    for (const cat of CAT_LIST) map[cat.code] = [];
    for (const t of ALL_TASKS) map[t.catCode].push(t);
    return map;
  }, []);

  /* Search mode: flat filtered list */
  const searchQuery   = search.trim().toLowerCase();
  const isSearching   = searchQuery.length > 0;
  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    return ALL_TASKS.filter((t) =>
      t.name.toLowerCase().includes(searchQuery) ||
      t.id.toLowerCase().includes(searchQuery)
    );
  }, [isSearching, searchQuery]);

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* Drawer */}
      {selectedTask && (
        <TaskDrawer
          task={selectedTask}
          onClose={() => setSelected(null)}
          onToast={showToast}
        />
      )}

      {/* Toast */}
      {toastMsg && <Toast msg={toastMsg} onDone={() => setToastMsg(null)} />}

      {/* ── Page header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-shrink-0">
        <div>
          <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">All Works</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">
            ABC Villa Construction · 94 tasks across 16 categories · Jun 22, 2026
          </p>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 w-64">
          <IconSearch />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks or IDs…"
            className="bg-transparent text-[12.5px] text-gray-700 placeholder-gray-400 outline-none flex-1"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-300 hover:text-gray-600">
              <IconClose />
            </button>
          )}
        </div>
      </div>

      {/* ── Summary bar ─────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {([
          { label: 'Total',          value: 94,                          bg: '#F9FAFB', text: '#374151', dot: '#9CA3AF' },
          { label: 'Completed',      value: SUMMARY['Completed'],        bg: '#F0FDF4', text: '#166534', dot: '#22C55E' },
          { label: 'In Progress',    value: SUMMARY['In Progress'],      bg: '#EFF6FF', text: '#1D4ED8', dot: '#3B82F6' },
          { label: 'Pending Review', value: SUMMARY['Pending Review'],   bg: '#FFFBEB', text: '#B45309', dot: '#F59E0B' },
          { label: 'Not Started',    value: SUMMARY['Not Started'],      bg: '#F9FAFB', text: '#6B7280', dot: '#D1D5DB' },
        ] as { label: string; value: number; bg: string; text: string; dot: string }[]).map((chip) => (
          <div key={chip.label} className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200"
            style={{ background: chip.bg }}>
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: chip.dot }} />
            <span className="text-[11.5px] font-bold tabular-nums" style={{ color: chip.text }}>
              {chip.value}
            </span>
            <span className="text-[11px] text-gray-400">{chip.label}</span>
          </div>
        ))}
      </div>

      {/* ── Content ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* Search results — flat list */}
        {isSearching ? (
          <div>
            <p className="text-[11.5px] text-gray-400 mb-3">
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for &quot;{search}&quot;
            </p>
            {searchResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                  <IconSearch />
                </div>
                <p className="text-[13px] font-semibold text-gray-300">No tasks match your search</p>
                <button onClick={() => setSearch('')}
                  className="mt-2 text-[12px] text-gray-400 hover:text-gray-900 underline">
                  Clear search
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-3 pb-6">
                {searchResults.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onView={() => setSelected(task)}
                    onToast={showToast}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Accordion list */
          <div className="space-y-2 pb-6">
            {CAT_LIST.map((cat) => (
              <CategoryAccordion
                key={cat.code}
                cat={cat}
                tasks={tasksByCat[cat.code] ?? []}
                open={openCats.has(cat.code)}
                onToggle={() => toggleCat(cat.code)}
                onViewTask={(task) => setSelected(task)}
                onToast={showToast}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
