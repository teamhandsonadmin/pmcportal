'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { updateDependencyCompletion } from '@/app/actions/dependencies';
import { TaskStatusControl } from '@/components/hvac/TaskStatusControl';
import type { DependencyCategory, DependencyItem, CompletionStatus, TaskStatus } from '@/lib/types/hvac';
import { isItemDone } from '@/lib/types/hvac';

/* ── Category config — dark monochrome ───────────────────── */
const CAT_CONFIG: Record<DependencyCategory, { label: string; color: string; bg: string; letter: string }> = {
  architect:  { label: 'Architect',   color: '#111111', bg: '#f3f4f6', letter: 'A' },
  client:     { label: 'Client',      color: '#1f2937', bg: '#f3f4f6', letter: 'C' },
  consultant: { label: 'Consultant',  color: '#374151', bg: '#f9fafb', letter: 'Co' },
  contractor: { label: 'Contractor',  color: '#4b5563', bg: '#f9fafb', letter: 'Cr' },
  inspector:  { label: 'Vendor',      color: '#6b7280', bg: '#f9fafb', letter: 'V' },
};

const STATUS_STYLE: Record<string, { label: string; bg: string; color: string; border: string }> = {
  draft:       { label: 'Draft',       bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' },
  ready:       { label: 'Ready',       bg: '#e5e7eb', color: '#374151', border: '#d1d5db' },
  in_progress: { label: 'In Progress', bg: '#111111', color: '#ffffff', border: '#111111' },
  on_hold:     { label: 'On Hold',     bg: '#f3f4f6', color: '#374151', border: '#d1d5db' },
  blocked:     { label: 'Blocked',     bg: '#1f2937', color: '#ffffff', border: '#1f2937' },
  completed:   { label: 'Completed',   bg: '#374151', color: '#ffffff', border: '#374151' },
};

/* ── Trello checkbox item ─────────────────────────────────── */
function TrelloCheckItem({ item, taskId, locked }: { item: DependencyItem; taskId: string; locked: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [localStatus, setLocalStatus] = useState<CompletionStatus>(item.completion?.status ?? 'pending');
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState(item.completion?.comment ?? '');

  const isDone = localStatus === 'delivered';
  const isNA   = localStatus === 'not_required';

  function toggleCheck() {
    if (locked || isPending) return;
    const next: CompletionStatus = isDone ? 'pending' : 'delivered';
    setLocalStatus(next);
    startTransition(async () => { await updateDependencyCompletion(item.id, taskId, next, comment || null); });
  }

  function setNA() {
    if (locked || isPending) return;
    const next: CompletionStatus = isNA ? 'pending' : 'not_required';
    setLocalStatus(next);
    startTransition(async () => { await updateDependencyCompletion(item.id, taskId, next, comment || null); });
  }

  async function saveNote() {
    startTransition(async () => {
      await updateDependencyCompletion(item.id, taskId, localStatus, comment || null);
      setShowComment(false);
    });
  }

  return (
    <div className={`flex items-start gap-3 py-2.5 px-1 rounded-lg hover:bg-gray-50 group transition-colors ${isPending ? 'opacity-60' : ''}`}>
      {/* Checkbox */}
      <button
        onClick={toggleCheck}
        disabled={locked || isPending}
        className="flex-shrink-0 w-[17px] h-[17px] mt-0.5 rounded border-2 flex items-center justify-center transition-all"
        style={{
          borderColor: isDone ? '#374151' : '#d1d5db',
          backgroundColor: isDone ? '#374151' : 'transparent',
        }}
      >
        {isDone && (
          <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
        {isNA && <span style={{ color: '#9ca3af', fontSize: '9px', lineHeight: 1 }}>—</span>}
      </button>

      <div className="flex-1 min-w-0">
        <span className={`text-[13px] leading-snug ${isDone || isNA ? 'line-through text-gray-400' : 'text-gray-800'}`}>
          {item.itemLabel}
        </span>
        {item.completion?.comment && !showComment && (
          <p className="text-[11px] text-gray-400 italic mt-0.5">"{item.completion.comment}"</p>
        )}
        {showComment && (
          <div className="mt-2 space-y-1.5">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a note…"
              rows={2}
              className="w-full text-[12px] border border-gray-200 rounded-md px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-gray-300"
            />
            <div className="flex gap-2">
              <button onClick={saveNote} className="text-[11.5px] font-medium px-3 py-1 bg-gray-900 text-white rounded-md hover:bg-black transition-colors">Save</button>
              <button onClick={() => setShowComment(false)} className="text-[11.5px] text-gray-500 hover:text-gray-800 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {!locked && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={setNA}
            className="text-[10px] font-medium px-1.5 py-0.5 rounded border transition-colors"
            style={{ color: isNA ? '#374151' : '#9ca3af', borderColor: isNA ? '#9ca3af' : '#e5e7eb', backgroundColor: isNA ? '#f3f4f6' : 'transparent' }}
          >N/A</button>
          {!showComment && (
            <button onClick={() => setShowComment(true)} className="text-[10px] text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded border border-transparent hover:border-gray-200 transition-all">
              Note
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Checklist card ──────────────────────────────────────── */
function ChecklistCard({ category, items, taskId, locked }: { category: DependencyCategory; items: DependencyItem[]; taskId: string; locked: boolean }) {
  const cfg   = CAT_CONFIG[category];
  const done  = items.filter((i) => isItemDone(i.completion?.status)).length;
  const total = items.length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
  const allDone = done === total && total > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100" style={{ backgroundColor: allDone ? '#f3f4f6' : cfg.bg }}>
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0" style={{ backgroundColor: cfg.color }}>
            {cfg.letter}
          </div>
          <span className="text-[12.5px] font-bold uppercase tracking-widest" style={{ color: cfg.color }}>
            {cfg.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {allDone && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-800 text-white">
              Complete
            </span>
          )}
          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: cfg.color }}>
            {done}/{total}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-gray-100">
        <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: cfg.color }} />
      </div>

      {/* Items */}
      <div className="px-4 py-2">
        {items.length === 0 ? (
          <p className="py-4 text-[12.5px] text-gray-400 text-center">No items in this category.</p>
        ) : (
          items.sort((a, b) => a.sortOrder - b.sortOrder).map((item) => (
            <TrelloCheckItem key={item.id} item={item} taskId={taskId} locked={locked} />
          ))
        )}
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────── */
interface TaskData {
  id: string; taskId: string; taskName: string; projectName: string;
  description: string | null; status: string; dueDate: Date | null;
  createdAt: Date; updatedAt: Date;
  work: { id: string; name: string; color: string; code: string } | null;
}

const PEOPLE = [
  { initials: 'AD', name: 'Admin',     role: 'Project Lead' },
  { initials: 'SE', name: 'Site Eng.', role: 'Site Engineer' },
  { initials: 'AR', name: 'Architect', role: 'Architect' },
];

const PEOPLE_COLORS = ['#111111', '#374151', '#6b7280'];

export function TrelloTaskDetail({ task, items, categories, locked }: {
  task: TaskData; items: DependencyItem[]; categories: DependencyCategory[]; locked: boolean;
}) {
  const allItems   = items.length;
  const doneItems  = items.filter((i) => isItemDone(i.completion?.status)).length;
  const overallPct = allItems > 0 ? Math.round((doneItems / allItems) * 100) : 0;
  const statusStyle = STATUS_STYLE[task.status] ?? STATUS_STYLE.draft;

  function fmt(d: Date | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return (
    <div className="space-y-5">

      {/* ── Header card ──────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)', borderLeft: '4px solid #111111' }}>
        <div className="px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 mb-3">
                <Link href="/works" className="text-[11px] text-gray-400 hover:text-gray-700 transition-colors flex items-center gap-1">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                  All Works
                </Link>
                {task.work && (
                  <>
                    <span className="text-gray-300">/</span>
                    <Link href={`/works/${task.work.id}`} className="text-[11px] text-gray-400 hover:text-gray-700 transition-colors">
                      {task.work.name}
                    </Link>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                <span className="text-[12px] font-bold font-mono text-gray-500">#{task.taskId}</span>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border" style={{ backgroundColor: statusStyle.bg, color: statusStyle.color, borderColor: statusStyle.border }}>
                  {statusStyle.label}
                </span>
                {locked && (
                  <span className="text-[11px] font-semibold text-gray-700 bg-gray-100 border border-gray-300 px-2.5 py-1 rounded-full">
                    Completed
                  </span>
                )}
              </div>

              <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">{task.taskName}</h1>
              <p className="text-[13px] text-gray-500 mt-0.5">{task.projectName}</p>
              {task.description && (
                <p className="text-[13px] text-gray-500 mt-2 leading-relaxed max-w-2xl">{task.description}</p>
              )}
            </div>

            {task.dueDate && (
              <div className="flex-shrink-0 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-right">
                <p className="text-[9.5px] uppercase tracking-widest text-gray-400 font-semibold mb-1">Due Date</p>
                <p className="text-[13px] font-mono font-semibold text-gray-800">{fmt(task.dueDate)}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Checklists + sidebar ──────────────────────────── */}
      <div className="grid grid-cols-3 gap-5">

        {/* Checklists (2/3) */}
        <div className="col-span-2 space-y-4">
          {categories.map((cat) => (
            <ChecklistCard
              key={cat}
              category={cat}
              items={items.filter((i) => i.category === cat)}
              taskId={task.id}
              locked={locked}
            />
          ))}
        </div>

        {/* Sidebar (1/3) */}
        <div className="space-y-4">

          {/* People */}
          <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">People Involved</h3>
            <div className="space-y-3">
              {PEOPLE.map((p, i) => (
                <div key={p.initials} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0" style={{ backgroundColor: PEOPLE_COLORS[i] }}>
                    {p.initials}
                  </div>
                  <div>
                    <div className="text-[12.5px] font-semibold text-gray-800">{p.name}</div>
                    <div className="text-[11px] text-gray-400">{p.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Status control */}
          {!locked && (
            <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Update Status</h3>
              <TaskStatusControl taskId={task.id} currentStatus={task.status as TaskStatus} />
              {task.status === 'draft' && (
                <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">Complete all dependency categories to move to Ready.</p>
              )}
              {task.status === 'blocked' && (
                <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">Task is blocked — clear all pending dependency items.</p>
              )}
            </div>
          )}

          {/* Overall progress */}
          <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Overall Progress</h3>
            <div className="flex items-end gap-2 mb-2.5">
              <span className="text-[28px] font-bold text-gray-900 leading-none">{overallPct}%</span>
              <span className="text-[12px] text-gray-400 mb-0.5">{doneItems}/{allItems} items</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500 bg-gray-900" style={{ width: `${overallPct}%` }} />
            </div>

            {/* Per-category mini bars */}
            <div className="mt-4 space-y-2.5">
              {categories.map((cat) => {
                const cfg      = CAT_CONFIG[cat];
                const catItems = items.filter((i) => i.category === cat);
                const catDone  = catItems.filter((i) => isItemDone(i.completion?.status)).length;
                const catPct   = catItems.length > 0 ? Math.round((catDone / catItems.length) * 100) : 0;
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-gray-500">{cfg.label}</span>
                      <span className="text-[11px] font-semibold tabular-nums text-gray-700">{catPct}%</span>
                    </div>
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${catPct}%`, backgroundColor: cfg.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dates / Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Details</h3>
            <div className="space-y-2.5">
              {[
                { label: 'Created',      value: fmt(task.createdAt) },
                { label: 'Due Date',     value: fmt(task.dueDate) },
                { label: 'Last Updated', value: fmt(task.updatedAt) },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-[12px] text-gray-500">{row.label}</span>
                  <span className="text-[12px] font-mono text-gray-700">{row.value}</span>
                </div>
              ))}
              {task.work && (
                <div className="flex items-center justify-between pt-1 border-t border-gray-100 mt-1">
                  <span className="text-[12px] text-gray-500">Work</span>
                  <Link href={`/works/${task.work.id}`} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                    <span className="w-4 h-4 rounded bg-gray-800 text-white text-[8px] font-bold flex items-center justify-center">
                      {task.work.code.slice(0, 1)}
                    </span>
                    <span className="text-[12px] font-medium text-gray-700">{task.work.name}</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
