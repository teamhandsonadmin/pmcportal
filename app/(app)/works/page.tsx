'use client';

import { useState, useMemo } from 'react';

/* ── Types ──────────────────────────────────────────────────── */
type ChkStatus = 'Not Started' | 'Pending Review' | 'Delivered';
type ColId     = 'Not Started' | 'In Progress' | 'Pending Review' | 'Completed';

interface ChkItem  { id: string; label: string; status: ChkStatus }
interface DepGroup { name: string; items: ChkItem[] }
interface LogItem  { text: string; time: string }
interface Task {
  id: string; seq: number;
  name: string; catCode: string; catName: string;
  accent: string; tagBg: string; tagText: string;
  column: ColId;
  dueDate: string; startDate: string;
  assignee: string; project: string; description: string;
  deps: DepGroup[]; log: LogItem[];
}

/* ── Constants ──────────────────────────────────────────────── */
const COLS: ColId[] = ['Not Started', 'In Progress', 'Pending Review', 'Completed'];

const COL_META: Record<ColId, { hdr: string; dot: string; text: string; dropBg: string }> = {
  'Not Started':    { hdr: '#F3F4F6', dot: '#9CA3AF', text: '#6B7280',  dropBg: '#F9FAFB' },
  'In Progress':    { hdr: '#DBEAFE', dot: '#3B82F6', text: '#1D4ED8',  dropBg: '#EFF6FF' },
  'Pending Review': { hdr: '#FEF3C7', dot: '#F59E0B', text: '#92400E',  dropBg: '#FFFBEB' },
  'Completed':      { hdr: '#DCFCE7', dot: '#22C55E', text: '#15803D',  dropBg: '#F0FDF4' },
};

const CHK_NEXT: Record<ChkStatus, ChkStatus> = {
  'Not Started':    'Pending Review',
  'Pending Review': 'Delivered',
  'Delivered':      'Not Started',
};

const CHK_STYLE: Record<ChkStatus, { bg: string; text: string; border: string }> = {
  'Not Started':    { bg: '#F9FAFB', text: '#6B7280', border: '#D1D5DB' },
  'Pending Review': { bg: '#FFFBEB', text: '#B45309', border: '#F59E0B' },
  'Delivered':      { bg: '#F0FDF4', text: '#15803D', border: '#22C55E' },
};

const DEP_DEFS = [
  { name: 'Architect',     labels: ['Drawing Approved',   'Layout Verified',       'Material Approved'    ] },
  { name: 'Consultant',    labels: ['Site Inspection',    'Technical Review',      'Technical Approval'   ] },
  { name: 'Client',        labels: ['Budget Approval',    'Material Selection',    'Final Confirmation'   ] },
  { name: 'Site Engineer', labels: ['Site Ready',         'Measurements Verified', 'Work Started'         ] },
  { name: 'Contractor',    labels: ['Material Available', 'Workforce Assigned',    'Execution Started'    ] },
];

const ENGINEERS = ['Kumar S', 'Arjun K', 'Manoj R', 'Priya R', 'Sanjay T', 'Ravi M', 'Deepa N', 'Karthik V'];
const PROJECTS  = ['ABC Villa'];
const DATES_DUE = ['10 Jul 2026','15 Jul 2026','20 Jul 2026','25 Jul 2026','30 Jul 2026','05 Aug 2026','10 Aug 2026','15 Aug 2026'];
const DATES_ST  = ['01 Jun 2026','05 Jun 2026','10 Jun 2026','15 Jun 2026','20 Jun 2026'];

/* ── Seed helpers ───────────────────────────────────────────── */
function seedDeps(idx: number, col: ColId): DepGroup[] {
  const dN = col === 'Completed' ? 12 + (idx % 4) : col === 'In Progress' ? 3 + (idx % 7) :
             col === 'Pending Review' ? 7 + (idx % 5) : idx % 3;
  const pN = col === 'Completed' ? 0 : col === 'Not Started' ? idx % 2 : (idx % 2) + 1;
  const st: ChkStatus[] = Array(15).fill('Not Started');
  for (let i = 0; i < Math.min(dN, 15); i++) st[i] = 'Delivered';
  for (let i = dN; i < Math.min(dN + pN, 15); i++) st[i] = 'Pending Review';
  return DEP_DEFS.map((g, gi) => ({
    name: g.name,
    items: g.labels.map((label, li) => ({ id: `${idx}-${gi}-${li}`, label, status: st[gi * 3 + li] })),
  }));
}

function seedLog(col: ColId): LogItem[] {
  const log: LogItem[] = [{ text: 'Task created and assigned to engineer', time: '14 Jun 2026, 9:00 AM' }];
  if (col !== 'Not Started') log.push({ text: 'Status moved to In Progress', time: '16 Jun 2026, 11:30 AM' });
  if (col === 'Pending Review' || col === 'Completed') {
    log.push({ text: 'Dependencies partially approved', time: '18 Jun 2026, 2:00 PM' });
    log.push({ text: 'Task submitted for Pending Review', time: '20 Jun 2026, 4:30 PM' });
  }
  if (col === 'Completed') {
    log.push({ text: 'All checklists marked Delivered', time: '21 Jun 2026, 10:00 AM' });
    log.push({ text: 'Task marked as Completed', time: '22 Jun 2026, 9:00 AM' });
  }
  return log;
}

/* ── Category definitions ───────────────────────────────────── */
const CAT_LIST = [
  { name:'HVAC',           code:'HVAC',    accent:'#3B82F6', tagBg:'#EFF6FF', tagText:'#1D4ED8',
    tasks:['AC Units Level Marking','HVAC Support Framing Works','HVAC Refrigerant Piping','Wall Chipping For HVAC Drain Outlet Pipe','HVAC Drain Outlet Pipe Routing','HVAC Drain Pipe Plastering'] },
  { name:'Electrical',     code:'ELEC',    accent:'#F59E0B', tagBg:'#FFFBEB', tagText:'#B45309',
    tasks:['Ceiling Electrical Conduit Marking','Ceiling Electrical Conduit Frame Works','Switch Board Level Marking','Wall Electrical Conduit Chipping','Wall Electrical Conduit & Back Box Fixing','Ceiling & Wall Electrical Wiring','Electrical Switch Boards & Wall Conduits Plastering','External Electrical Works','Non-Electrical Floor Conduit And Wiring Works','Ceiling Down Lights Fixing','Electrical Switch Boards Fixing','Ceiling Fans And Exhaust Fans Fixing','Wardrobe Profile Lights Fixing'] },
  { name:'Plumbing',       code:'PLUM',    accent:'#06B6D4', tagBg:'#ECFEFF', tagText:'#0E7490',
    tasks:['CPVC & PVC Pipe Level Marking','Suspended Ceiling Framing For PVC & CPVC','Sanitary & Kitchen Fittings Level Marking','Wall Chipping For CPVC/PVC Pipes','Plumbing CPVC & PVC Pipe Routing','Water Pressure Testing','WC Flush Tanks And Concealed Parts Fixing','Toilet Plumbing Pipes, Ledge Wall Masonry & Plastering','External Plumbing Works','Swimming Pool Plumbing Works','Sanitary Fittings Fixing'] },
  { name:'Civil Works',    code:'CIVIL',   accent:'#6B7280', tagBg:'#F9FAFB', tagText:'#374151',
    tasks:['Door & Window Opening Corrections & Plastering','Terrace/Balcony Debris Cleaning','Electrical Switch Board Plastering','Swimming Pool Civil Changes','Swimming Pool Debris Cleaning','Swimming Pool Masonry Packing & Plastering','Sunken Filling','Toilet Floor Tile Laying','Terrace/Balcony Waterproofing','Terrace/Balcony Sunken Slab Water Pond Test'] },
  { name:'Flooring',       code:'FLOOR',   accent:'#F97316', tagBg:'#FFF7ED', tagText:'#C2410C',
    tasks:['Tile Bull Marking','Window Stone Jambing Works','Internal Marble Flooring','Marble Polishing','Marble Floor Protection Sheets Laying','Kitchen Counter Stone Laying','Toilet Vanity Counter Stone Laying','Toilet Floor Tiling & Dado Works','Swimming Pool Wall Tiling & Dado Works','External Flooring'] },
  { name:'False Ceiling',  code:'F.CEIL',  accent:'#A855F7', tagBg:'#FAF5FF', tagText:'#7E22CE',
    tasks:['Gypsum & Wooden False Ceiling Level Marking','GI & Wood Framing Works','Gypsum Ceiling Sheeting','Ceiling Cuttings For Lights','Gypsum Ceiling Joint Finishing','Putty Coating For Gypsum Ceiling','Sanding And Primer For Gypsum Ceiling'] },
  { name:'Carpentry',      code:'CARPNTR', accent:'#D97706', tagBg:'#FFFBEB', tagText:'#92400E',
    tasks:['Wooden Supports For Curtain Pelmets','Main Door & Internal Door Measurements','Main Door & Internal Door Erection','Wooden Ceiling Cutouts For Lights','Fluted Panels / Veneer Fixing','Wooden Wall Panelling','Curtain Pelmet Fixing'] },
  { name:'POP Works',      code:'POP',     accent:'#EC4899', tagBg:'#FDF2F8', tagText:'#BE185D',
    tasks:['Wall Bull Marks','Wall Hacking Works','Wall Punning Works'] },
  { name:'Painting',       code:'PAINT',   accent:'#EF4444', tagBg:'#FEF2F2', tagText:'#B91C1C',
    tasks:['External Painting','Putty 2 Coats (Internal / External)','Sanding','Base Primer','First Coat Paint','Second Coat Paint','Texture Paint','Main Gate Painting'] },
  { name:'Aluminium D&W',  code:'ALU',     accent:'#64748B', tagBg:'#F8FAFC', tagText:'#334155',
    tasks:['Measurements','Sliding Door Erection'] },
  { name:'Glass Works',    code:'GLASS',   accent:'#38BDF8', tagBg:'#F0F9FF', tagText:'#0369A1',
    tasks:['Mirror & Shower Partition Measurements','Mirror & Shower Partition Fixing'] },
  { name:'Modular Works',  code:'MODULAR', accent:'#22C55E', tagBg:'#F0FDF4', tagText:'#15803D',
    tasks:['Site Measurements For Kitchen, Wardrobes & Vanity','Modular Unit Erection','Wardrobe Installation','Kitchen Installation','Vanity Installation'] },
  { name:'Fabrication',    code:'FABRI',   accent:'#DC2626', tagBg:'#FEF2F2', tagText:'#991B1B',
    tasks:['MS Stair Case Works','Terrace Pergola Works','Main Gate & Wicket Gate Fabrication'] },
  { name:'Waterproofing',  code:'W.PROOF', accent:'#14B8A6', tagBg:'#F0FDFA', tagText:'#0F766E',
    tasks:['Terrace / Balcony / Planter Box Waterproofing','Toilet Sunken Slab Water Pond Test','Swimming Pool Waterproofing'] },
  { name:'Lighting',       code:'LIGHT',   accent:'#EAB308', tagBg:'#FEFCE8', tagText:'#A16207',
    tasks:['Decorative Lights Fixing'] },
  { name:'Landscape',      code:'LSCAPE',  accent:'#10B981', tagBg:'#ECFDF5', tagText:'#065F46',
    tasks:['Drainage Medium Installation','Soil Filling','Plantation Works'] },
];

/* ── Build task list ────────────────────────────────────────── */
let _s = 0;
const INITIAL_TASKS: Task[] = CAT_LIST.flatMap((cat) =>
  cat.tasks.map((name) => {
    const i = _s++;
    const r = i % 11;
    const col: ColId = r < 2 ? 'Completed' : r < 5 ? 'In Progress' : r < 7 ? 'Pending Review' : 'Not Started';
    return {
      id: `TASK-${String(i + 1).padStart(3, '0')}`, seq: i + 1, name,
      catCode: cat.code, catName: cat.name, accent: cat.accent, tagBg: cat.tagBg, tagText: cat.tagText,
      column: col,
      dueDate:   DATES_DUE[i % DATES_DUE.length],
      startDate: DATES_ST[i % DATES_ST.length],
      assignee:  ENGINEERS[i % ENGINEERS.length],
      project:   PROJECTS[i % PROJECTS.length],
      description: `${name} — part of the ${cat.name} scope. Includes site preparation, material coordination, and quality inspection per project specifications.`,
      deps: seedDeps(i, col),
      log:  seedLog(col),
    };
  })
);

/* ── Utility ────────────────────────────────────────────────── */
function calcPct(t: Task): number {
  const all = t.deps.flatMap((d) => d.items);
  return all.length ? Math.round(all.filter((i) => i.status === 'Delivered').length / all.length * 100) : 0;
}

/* ── TaskCard ───────────────────────────────────────────────── */
function TaskCard({ task, onSelect, onDragStart }: {
  task: Task; onSelect: () => void; onDragStart: () => void;
}) {
  const pct  = calcPct(task);
  const done = task.deps.flatMap((d) => d.items).filter((i) => i.status === 'Delivered').length;
  const pending = task.deps.flatMap((d) => d.items).filter((i) => i.status === 'Pending Review').length;

  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
      onClick={onSelect}
      className="bg-white rounded-xl border border-gray-200 p-3.5 cursor-grab active:cursor-grabbing group transition-all"
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; (e.currentTarget as HTMLElement).style.borderColor = '#9CA3AF'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'; (e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB'; }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <span className="text-[10px] font-mono font-bold text-gray-400 leading-none mt-0.5">{task.id}</span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
          style={{ background: task.tagBg, color: task.tagText }}>{task.catCode}</span>
      </div>

      {/* Name */}
      <p className="text-[12.5px] font-semibold text-gray-900 leading-snug mb-3">{task.name}</p>

      {/* Progress */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10.5px] text-gray-400">
            {done}/15 delivered{pending > 0 && ` · ${pending} pending`}
          </span>
          <span className="text-[11px] font-bold text-gray-800 tabular-nums">{pct}%</span>
        </div>
        <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: pct === 100 ? '#22C55E' : pct > 60 ? '#111' : '#111' }} />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2.5 border-t border-gray-50">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
            <span className="text-[7px] font-black text-gray-500">
              {task.assignee.split(' ').map((n) => n[0]).join('')}
            </span>
          </div>
          <span className="text-[10.5px] text-gray-400 truncate max-w-[80px]">{task.assignee}</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          <span className="text-[10px] text-gray-300 font-mono">{task.dueDate.replace(' 2026','')}</span>
        </div>
      </div>
    </div>
  );
}

/* ── TaskDrawer ─────────────────────────────────────────────── */
function TaskDrawer({ task, onClose, onChkToggle, onMoveToCol }: {
  task: Task; onClose: () => void;
  onChkToggle: (taskId: string, itemId: string) => void;
  onMoveToCol: (taskId: string, col: ColId) => void;
}) {
  const [openDep, setOpenDep] = useState<string | null>(DEP_DEFS[0].name);
  const pct  = calcPct(task);
  const done = task.deps.flatMap((d) => d.items).filter((i) => i.status === 'Delivered').length;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/10" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex flex-col bg-white border-l border-gray-200 w-[580px]"
        style={{ boxShadow: '-8px 0 32px rgba(0,0,0,0.08)' }}>

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10.5px] font-mono font-bold text-gray-400">{task.id}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                style={{ background: task.tagBg, color: task.tagText }}>{task.catCode} · {task.catName}</span>
            </div>
            <h2 className="text-[15px] font-bold text-gray-900 leading-snug">{task.name}</h2>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* Info grid */}
          <div className="px-6 py-4 grid grid-cols-2 gap-2.5 border-b border-gray-50">
            {[
              { l: 'Project',     v: task.project    },
              { l: 'Assigned To', v: task.assignee   },
              { l: 'Start Date',  v: task.startDate  },
              { l: 'Due Date',    v: task.dueDate    },
              { l: 'Status',      v: task.column     },
              { l: 'Category',    v: task.catName    },
            ].map((f) => (
              <div key={f.l} className="rounded-xl bg-gray-50 px-3.5 py-2.5">
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-gray-400 mb-1">{f.l}</p>
                <p className="text-[12.5px] font-semibold text-gray-800">{f.v}</p>
              </div>
            ))}
          </div>

          {/* Move to */}
          <div className="px-6 py-4 border-b border-gray-50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2.5">Move Task To</p>
            <div className="flex items-center gap-2">
              {COLS.map((col) => {
                const m = COL_META[col];
                const active = task.column === col;
                return (
                  <button key={col} onClick={() => onMoveToCol(task.id, col)}
                    className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all border"
                    style={{
                      background:  active ? m.hdr : 'transparent',
                      borderColor: active ? m.dot : '#E5E7EB',
                      color:       active ? m.text : '#9CA3AF',
                      fontWeight:  active ? '700' : '500',
                    }}>
                    {col}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div className="px-6 py-4 border-b border-gray-50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Description</p>
            <p className="text-[12.5px] text-gray-600 leading-relaxed">{task.description}</p>
          </div>

          {/* Progress */}
          <div className="px-6 py-4 border-b border-gray-50">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Progress</p>
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] font-bold text-gray-900 tabular-nums">{done}/15 delivered</span>
                <span className="text-[12px] font-black tabular-nums"
                  style={{ color: pct === 100 ? '#15803D' : '#111' }}>{pct}%</span>
              </div>
            </div>
            <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: pct === 100 ? '#22C55E' : '#111' }} />
            </div>
            {/* Mini dep status breakdown */}
            <div className="flex items-center gap-3 mt-3">
              {(['Delivered','Pending Review','Not Started'] as ChkStatus[]).map((s) => {
                const count = task.deps.flatMap((d) => d.items).filter((i) => i.status === s).length;
                const cs = CHK_STYLE[s];
                return (
                  <div key={s} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: cs.border }} />
                    <span className="text-[10.5px] font-semibold" style={{ color: cs.text }}>{count} {s}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dependency groups */}
          <div className="px-6 py-4 border-b border-gray-50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">Dependencies · 5 Groups · 15 Items</p>
            <div className="space-y-2">
              {task.deps.map((grp) => {
                const delivN  = grp.items.filter((i) => i.status === 'Delivered').length;
                const pendN   = grp.items.filter((i) => i.status === 'Pending Review').length;
                const isOpen  = openDep === grp.name;
                const grpPct  = Math.round((delivN / grp.items.length) * 100);
                return (
                  <div key={grp.name} className="rounded-xl border border-gray-100 overflow-hidden">
                    <button onClick={() => setOpenDep(isOpen ? null : grp.name)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[12.5px] font-bold text-gray-800">{grp.name}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500">
                          {delivN}/{grp.items.length}
                        </span>
                        {pendN > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700">
                            {pendN} pending
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full bg-gray-800 transition-all" style={{ width: `${grpPct}%` }} />
                        </div>
                        <span className="text-[10.5px] font-bold text-gray-500 tabular-nums w-8 text-right">{grpPct}%</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.2"
                          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                          <path d="M6 9l6 6 6-6"/>
                        </svg>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-3 space-y-1.5 border-t border-gray-50">
                        {grp.items.map((item) => {
                          const cs = CHK_STYLE[item.status];
                          return (
                            <button key={item.id} onClick={() => onChkToggle(task.id, item.id)}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all"
                              style={{ background: cs.bg }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.8'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}>
                              {/* Checkbox */}
                              <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all"
                                style={{ borderColor: cs.border, background: item.status === 'Delivered' ? cs.border : 'white' }}>
                                {item.status === 'Delivered' && (
                                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>
                                )}
                                {item.status === 'Pending Review' && (
                                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: cs.border }} />
                                )}
                              </div>
                              <span className="flex-1 text-[12px] font-semibold" style={{ color: cs.text }}>{item.label}</span>
                              <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0"
                                style={{ color: cs.text, borderColor: cs.border + '60', background: 'white' }}>
                                {item.status}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Activity log */}
          <div className="px-6 py-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">Activity Timeline</p>
            <div className="space-y-0">
              {task.log.map((l, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-gray-300 mt-1.5" />
                    {i < task.log.length - 1 && <div className="w-px bg-gray-100 flex-1 min-h-[20px] mt-1" />}
                  </div>
                  <div className="pb-3">
                    <p className="text-[12px] font-semibold text-gray-700">{l.text}</p>
                    <p className="text-[10.5px] text-gray-400 mt-0.5">{l.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Main Page ──────────────────────────────────────────────── */
export default function WorksPage() {
  const [tasks,      setTasks]   = useState<Task[]>(INITIAL_TASKS);
  const [search,     setSearch]  = useState('');
  const [catF,       setCatF]    = useState('');
  const [colF,       setColF]    = useState<ColId | ''>('');
  const [engF,       setEngF]    = useState('');
  const [projF,      setProjF]   = useState('');
  const [selectedId, setSelId]   = useState<string | null>(null);
  const [draggingId, setDragId]  = useState<string | null>(null);
  const [dragOverC,  setDragOC]  = useState<ColId | null>(null);

  const selected = selectedId ? (tasks.find((t) => t.id === selectedId) ?? null) : null;

  /* Filtered task list */
  const filtered = useMemo(() => tasks.filter((t) =>
    (!search || t.name.toLowerCase().includes(search.toLowerCase()) || t.id.toLowerCase().includes(search.toLowerCase())) &&
    (!catF  || t.catCode  === catF) &&
    (!colF  || t.column   === colF) &&
    (!engF  || t.assignee === engF) &&
    (!projF || t.project  === projF)
  ), [tasks, search, catF, colF, engF, projF]);

  /* Checklist toggle */
  const handleChkToggle = (taskId: string, itemId: string) => {
    setTasks((prev) => prev.map((t) => {
      if (t.id !== taskId) return t;
      const newDeps = t.deps.map((grp) => ({
        ...grp,
        items: grp.items.map((item) => item.id === itemId ? { ...item, status: CHK_NEXT[item.status] } : item),
      }));
      return { ...t, deps: newDeps, log: [...t.log, { text: 'Checklist item updated', time: 'Just now' }] };
    }));
  };

  /* Drag & drop */
  const handleDrop = (col: ColId) => {
    if (!draggingId) return;
    setTasks((prev) => prev.map((t) =>
      t.id === draggingId
        ? { ...t, column: col, log: [...t.log, { text: `Task moved to ${col}`, time: 'Just now' }] }
        : t
    ));
    setDragId(null); setDragOC(null);
  };

  /* Move from drawer */
  const handleMoveToCol = (taskId: string, col: ColId) => {
    setTasks((prev) => prev.map((t) =>
      t.id === taskId ? { ...t, column: col, log: [...t.log, { text: `Task moved to ${col}`, time: 'Just now' }] } : t
    ));
  };

  /* Filter options */
  const catOptions  = [...new Set(tasks.map((t) => t.catCode))];
  const engOptions  = [...new Set(tasks.map((t) => t.assignee))];
  const projOptions = [...new Set(tasks.map((t) => t.project))];
  const hasFilter   = !!(search || catF || colF || engF || projF);

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* Drawer */}
      {selected && (
        <TaskDrawer
          task={selected}
          onClose={() => setSelId(null)}
          onChkToggle={handleChkToggle}
          onMoveToCol={handleMoveToCol}
        />
      )}

      {/* ── Page header ──────────────────────────────────── */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">Tasks & Works</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">ABC Villa · {tasks.length} tasks across 16 categories</p>
        </div>
        {hasFilter && (
          <button onClick={() => { setSearch(''); setCatF(''); setColF(''); setEngF(''); setProjF(''); }}
            className="text-[12px] font-semibold text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">
            Clear filters
          </button>
        )}
      </div>

      {/* ── Filters bar ──────────────────────────────────── */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        {/* Search */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 flex-1 max-w-xs">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks or IDs…"
            className="bg-transparent text-[12.5px] text-gray-700 placeholder-gray-400 outline-none flex-1" />
        </div>

        {/* Category */}
        <select value={catF} onChange={(e) => setCatF(e.target.value)}
          className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-[12.5px] text-gray-600 outline-none cursor-pointer hover:border-gray-400 transition-colors">
          <option value="">All Categories</option>
          {catOptions.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Status */}
        <select value={colF} onChange={(e) => setColF(e.target.value as ColId | '')}
          className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-[12.5px] text-gray-600 outline-none cursor-pointer hover:border-gray-400 transition-colors">
          <option value="">All Statuses</option>
          {COLS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Engineer */}
        <select value={engF} onChange={(e) => setEngF(e.target.value)}
          className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-[12.5px] text-gray-600 outline-none cursor-pointer hover:border-gray-400 transition-colors">
          <option value="">All Engineers</option>
          {engOptions.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>

        {/* Project */}
        <select value={projF} onChange={(e) => setProjF(e.target.value)}
          className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-[12.5px] text-gray-600 outline-none cursor-pointer hover:border-gray-400 transition-colors">
          <option value="">All Projects</option>
          {projOptions.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <div className="text-[11.5px] text-gray-400 ml-auto">
          {filtered.length} of {tasks.length} tasks shown
        </div>
      </div>

      {/* ── Task grid ────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
            </div>
            <p className="text-[13px] font-semibold text-gray-300">No tasks found</p>
            {hasFilter && (
              <button onClick={() => { setSearch(''); setCatF(''); setColF(''); setEngF(''); setProjF(''); }}
                className="mt-3 text-[12px] font-semibold text-gray-400 hover:text-gray-900 underline">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3 pb-6">
            {filtered.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onSelect={() => setSelId(task.id)}
                onDragStart={() => setDragId(task.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
