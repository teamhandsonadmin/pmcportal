'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import {
  addDependencyItem,
  deleteDependencyItem,
  updateDependencyCompletion,
  updateDependencyItemLabel,
} from '@/app/actions/dependencies';
import type { DependencyCategory, DependencyItem, CompletionStatus } from '@/lib/types/hvac';
import { CATEGORY_COLORS, isItemDone } from '@/lib/types/hvac';

/* ── Status dropdown — three color-coded chip options, replacing the old
   checkbox + separate N/A button. Selecting an option saves immediately. */
const STATUS_CHIP: Record<CompletionStatus, { label: string; bg: string; text: string; dot: string }> = {
  pending:      { label: 'Not Started',    bg: '#F3F4F6', text: '#4B5563', dot: '#9CA3AF' },
  delivered:    { label: 'Completed',      bg: '#DCFCE7', text: '#15803D', dot: '#22C55E' },
  not_required: { label: 'Not Applicable', bg: '#EDE9FE', text: '#6D28D9', dot: '#8B5CF6' },
};
const STATUS_ORDER: CompletionStatus[] = ['pending', 'delivered', 'not_required'];

function StatusDropdown({
  status,
  disabled,
  onChange,
}: {
  status: CompletionStatus;
  disabled: boolean;
  onChange: (status: CompletionStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cfg = STATUS_CHIP[status];

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-opacity disabled:opacity-60"
        style={{ backgroundColor: cfg.bg, color: cfg.text }}
      >
        <span className="w-[6px] h-[6px] rounded-full flex-shrink-0" style={{ backgroundColor: cfg.dot }} />
        {cfg.label}
      </button>

      {open && (
        <div className="absolute z-10 top-full left-0 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {STATUS_ORDER.map((s) => {
            const opt = STATUS_CHIP[s];
            return (
              <button
                key={s}
                onClick={() => { onChange(s); setOpen(false); }}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 hover:bg-gray-50 transition-colors"
              >
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                  style={{ backgroundColor: opt.bg, color: opt.text }}
                >
                  <span className="w-[6px] h-[6px] rounded-full flex-shrink-0" style={{ backgroundColor: opt.dot }} />
                  {opt.label}
                </span>
                {s === status && (
                  <svg className="ml-auto" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Category config — colored per category so each checklist is easy to
   tell apart at a glance, reusing the same palette as the template editor. */
const CAT_LABEL: Record<DependencyCategory, string> = {
  architect: 'Architect',
  client: 'Client',
  consultant: 'Consultant',
  contractor: 'Contractor',
  inspector: 'Vendor',
  procurement: 'Procurement',
};
const CAT_LETTER: Record<DependencyCategory, string> = {
  architect: 'A',
  client: 'C',
  consultant: 'Co',
  contractor: 'Cr',
  inspector: 'V',
  procurement: 'P',
};
function catConfig(category: DependencyCategory) {
  const c = CATEGORY_COLORS[category];
  return { label: CAT_LABEL[category], letter: CAT_LETTER[category], color: c.text, bg: c.bg };
}

/* ── Trello checkbox item ─────────────────────────────────── */
function TrelloCheckItem({ item, taskId, locked }: { item: DependencyItem; taskId: string; locked: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [localStatus, setLocalStatus] = useState<CompletionStatus>(item.completion?.status ?? 'pending');
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState(item.completion?.comment ?? '');
  const [isEditing, setIsEditing] = useState(false);
  const [labelText, setLabelText] = useState(item.itemLabel);

  const isDone = localStatus === 'delivered';
  const isNA   = localStatus === 'not_required';

  function saveLabel() {
    const trimmed = labelText.trim();
    if (!trimmed || trimmed === item.itemLabel) {
      setLabelText(item.itemLabel);
      setIsEditing(false);
      return;
    }
    startTransition(async () => {
      await updateDependencyItemLabel(item.id, taskId, trimmed);
      setIsEditing(false);
    });
  }

  function remove() {
    if (!window.confirm('Delete this checklist item?')) return;
    startTransition(async () => { await deleteDependencyItem(item.id, taskId); });
  }

  function changeStatus(next: CompletionStatus) {
    if (locked || isPending) return;
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
      <div className="mt-0.5">
        <StatusDropdown status={localStatus} disabled={locked || isPending} onChange={changeStatus} />
      </div>

      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            value={labelText}
            onChange={(e) => setLabelText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveLabel(); if (e.key === 'Escape') { setLabelText(item.itemLabel); setIsEditing(false); } }}
            onBlur={saveLabel}
            autoFocus
            className="w-full text-[13px] text-gray-800 outline-none border-b border-gray-300 bg-transparent pb-0.5"
          />
        ) : (
          <span className={`text-[13px] leading-snug ${isDone || isNA ? 'line-through text-gray-400' : 'text-gray-800'}`}>
            {item.itemLabel}
          </span>
        )}
        {item.completion?.comment && !showComment && (
          <p className="text-[11px] text-gray-400 italic mt-0.5">&ldquo;{item.completion.comment}&rdquo;</p>
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

      {!locked && !isEditing && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {!showComment && (
            <button onClick={() => setShowComment(true)} className="text-[10px] text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded border border-transparent hover:border-gray-200 transition-all">
              Note
            </button>
          )}
          <button
            onClick={() => setIsEditing(true)}
            title="Edit item"
            className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            onClick={remove}
            title="Delete item"
            className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Checklist card ──────────────────────────────────────── */
function ChecklistCard({ category, items, taskId, locked }: { category: DependencyCategory; items: DependencyItem[]; taskId: string; locked: boolean }) {
  const cfg   = catConfig(category);
  const done  = items.filter((i) => isItemDone(i.completion?.status)).length;
  const total = items.length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
  const allDone = done === total && total > 0;

  const [isPending, startTransition] = useTransition();
  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const addRef = useRef<HTMLInputElement>(null);

  function startAdd() {
    setIsAdding(true);
    setNewLabel('');
    setTimeout(() => addRef.current?.focus(), 50);
  }

  function submitAdd() {
    const trimmed = newLabel.trim();
    if (!trimmed) { setIsAdding(false); return; }
    startTransition(async () => { await addDependencyItem(taskId, category, trimmed); });
    setIsAdding(false);
    setNewLabel('');
  }

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
        {items.length === 0 && !isAdding && (
          <p className="py-4 text-[12.5px] text-gray-400 text-center">No items in this category.</p>
        )}
        {items.sort((a, b) => a.sortOrder - b.sortOrder).map((item) => (
          <TrelloCheckItem key={item.id} item={item} taskId={taskId} locked={locked} />
        ))}

        {!locked && (
          isAdding ? (
            <div className="flex items-center gap-3 py-2.5 px-1">
              <input
                ref={addRef}
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitAdd(); if (e.key === 'Escape') setIsAdding(false); }}
                onBlur={submitAdd}
                placeholder="Type checklist item and press Enter…"
                autoFocus
                disabled={isPending}
                className="flex-1 text-[13px] text-gray-800 outline-none border-b border-gray-300 bg-transparent pb-0.5 placeholder-gray-400"
              />
              <button onClick={() => setIsAdding(false)} className="text-[11px] text-gray-400 hover:text-gray-700">Cancel</button>
            </div>
          ) : (
            <button
              onClick={startAdd}
              className="flex items-center gap-1.5 w-full py-2 px-1 text-left text-[12.5px] text-gray-400 hover:text-gray-700 transition-colors"
            >
              <span className="text-[14px] leading-none">+</span> Add item…
            </button>
          )
        )}
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────── */
// Deliberately minimal by request: just the 5-category checklist, nothing
// else. Task identification (name/status/due date) is already shown by the
// shared header in app/(app)/hvac/[taskId]/layout.tsx, which wraps this
// page — repeating it here would be the "duplicate header" that was removed.
// Status changes, prerequisite tasks, and progress summaries now live only
// on the /overview sub-route.
interface TaskData {
  id: string; taskId: string; taskName: string; projectName: string;
  description: string | null; status: string;
  plannedStartDate: Date | null; dueDate: Date | null;
  createdAt: Date; updatedAt: Date;
  work: { id: string; name: string; color: string; code: string } | null;
  assignee: { fullName: string; role: string } | null;
}

export function TrelloTaskDetail({ task, items, categories, locked }: {
  task: TaskData; items: DependencyItem[]; categories: DependencyCategory[]; locked: boolean;
}) {
  return (
    <div className="space-y-4">
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
  );
}
