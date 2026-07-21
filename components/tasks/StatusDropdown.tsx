'use client';

import { useEffect, useRef, useState } from 'react';
import type { CompletionStatus } from '@/lib/types/tasks';

/* ── Shared 6-state status dropdown ──────────────────────────
   Used by both checklist UIs (TrelloTaskDetail's inline ChecklistCard on
   /tasks/[taskId], and ChecklistItem on /tasks/[taskId]/dependencies) so the
   two don't drift into two different pieces of dropdown code again. */

export const STATUS_CHIP: Record<CompletionStatus, { label: string; bg: string; text: string; dot: string }> = {
  YES:       { label: 'Issued',    bg: '#DCFCE7', text: '#15803D', dot: '#22C55E' },
  PROCEED:   { label: 'Proceed',   bg: '#CCFBF1', text: '#0F766E', dot: '#14B8A6' },
  PENDING:   { label: 'Pending',   bg: '#FEE2E2', text: '#B91C1C', dot: '#EF4444' },
  ON_HOLD:   { label: 'On Hold',   bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
  REVISIONS: { label: 'Revisions', bg: '#FFEDD5', text: '#C2410C', dot: '#FB923C' },
  NO:        { label: 'Not Required', bg: '#DBEAFE', text: '#1E40AF', dot: '#3B82F6' },
};
// PROCEED deliberately excluded — retired from the picker (same pattern as
// the 'inspector' DependencyCategory: kept in STATUS_CHIP/CLEARING_STATUSES
// below so any task that already has this status still renders and still
// counts as done), just no longer offered as a new choice.
export const STATUS_ORDER: CompletionStatus[] = ['YES', 'PENDING', 'ON_HOLD', 'REVISIONS', 'NO'];

// Clears vs. blocks — mirrors isItemDone() in lib/types/tasks.ts.
export const CLEARING_STATUSES: CompletionStatus[] = ['YES', 'PROCEED'];

function WarningIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function StatusDropdown({
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
  const isNo = status === 'NO';

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
        style={{ backgroundColor: cfg.bg, color: cfg.text, fontWeight: isNo ? 700 : 600 }}
      >
        {isNo ? <WarningIcon /> : <span className="w-[6px] h-[6px] rounded-full flex-shrink-0" style={{ backgroundColor: cfg.dot }} />}
        {cfg.label}
      </button>

      {open && (
        <div className="absolute z-10 top-full left-0 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {STATUS_ORDER.map((s) => {
            const opt = STATUS_CHIP[s];
            const optIsNo = s === 'NO';
            return (
              <button
                key={s}
                onClick={() => { onChange(s); setOpen(false); }}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 hover:bg-gray-50 transition-colors"
              >
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px]"
                  style={{ backgroundColor: opt.bg, color: opt.text, fontWeight: optIsNo ? 700 : 600 }}
                >
                  {optIsNo ? <WarningIcon size={9} /> : <span className="w-[6px] h-[6px] rounded-full flex-shrink-0" style={{ backgroundColor: opt.dot }} />}
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
