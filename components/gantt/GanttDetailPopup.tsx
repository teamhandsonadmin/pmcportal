'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { formatDate } from '@/lib/utils/format';
import { STATUS_LABELS } from '@/lib/utils/status-rules';
import { fetchTaskScheduleImpact } from '@/app/actions/schedule-impact';
import type { TaskScheduleImpact } from '@/lib/data/delay-engine';
import type { TaskRow } from '@/components/tasks/TasksExplorer';

interface GanttDetailPopupProps {
  // The clicked row's already-known display fields (Work, assignee) — no
  // need to fetch these again, only the delay figures require a fresh call.
  row: TaskRow | null;
  onClose: () => void;
}

export function GanttDetailPopup({ row, onClose }: GanttDetailPopupProps) {
  const [impact, setImpact] = useState<TaskScheduleImpact | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // This resets local state ahead of an async fetch keyed on `row` — there's
    // no render-time value to derive it from instead, since whether the fetch
    // is even needed depends on `row` itself changing. Clearing `impact` on
    // `row === null` (not just skipping the fetch) matters even though the
    // Dialog's `open` prop is already false at that point — Base UI keeps the
    // content mounted through the close animation, so the `{impact && ...}`
    // block below would otherwise still render with a real, non-null
    // `impact` left over from the previous row while `row` itself is null,
    // crashing on that block's `row!.id` non-null assertions.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setImpact(null);
    setError(null);
    if (!row) { setLoading(false); return; }
    setLoading(true);
    fetchTaskScheduleImpact(row.id)
      .then((result) => {
        if (!result) { setError('Could not load schedule details for this task'); return; }
        setImpact(result);
      })
      .catch(() => setError('Could not load schedule details for this task'))
      .finally(() => setLoading(false));
  }, [row]);

  return (
    <Dialog open={!!row} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{row?.taskName ?? 'Task'}</DialogTitle>
          <DialogDescription className="font-mono">{row?.taskId}</DialogDescription>
        </DialogHeader>

        {row && (
          <div className="mt-1 flex items-center gap-2 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: row.workColor }} />
              {row.workName}
            </span>
            <span>·</span>
            <span>{row.assigneeName ?? 'Unassigned'}</span>
            <span>·</span>
            <span>{STATUS_LABELS[row.status]}</span>
          </div>
        )}

        {loading && <p className="mt-4 text-[12.5px] text-muted-foreground">Loading…</p>}
        {error && (
          <div className="mt-4 p-2.5 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-600">{error}</div>
        )}

        {impact && (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-2.5 rounded-lg bg-muted/50 border border-border">
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Planned</p>
                <p className="text-[12.5px] font-mono">{formatDate(impact.self.plannedStartDate)} → {formatDate(impact.self.dueDate)}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/50 border border-border">
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Projected / Actual</p>
                <p className="text-[12.5px] font-mono">{formatDate(impact.self.projectedStart)} → {formatDate(impact.self.projectedFinish)}</p>
              </div>
            </div>

            {impact.self.totalDelayDays > 0 ? (
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200">
                <p className="text-[13px] font-medium text-red-600">
                  {impact.self.totalDelayDays} working day{impact.self.totalDelayDays === 1 ? '' : 's'} behind plan
                </p>
                <p className="text-[11.5px] text-red-600/80 mt-0.5">
                  {impact.self.inheritedDelayDays} inherited, {impact.self.ownDelayDays} added by this task
                </p>
              </div>
            ) : (
              <div className="p-2.5 rounded-lg bg-green-50 border border-green-200">
                <p className="text-[13px] font-medium text-green-700">On schedule</p>
              </div>
            )}

            {impact.drivingPrerequisite && (
              <p className="text-[12px] text-muted-foreground">
                Delayed by{' '}
                <Link
                  href={`/tasks/${impact.drivingPrerequisite.id}/overview`}
                  className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
                >
                  {impact.drivingPrerequisite.taskCode} — {impact.drivingPrerequisite.taskName}
                </Link>
              </p>
            )}

            {impact.downstreamImpacted.length > 0 && (
              <div className="pt-2 border-t border-border/60">
                <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">
                  Driving delay for {impact.downstreamImpacted.length} downstream task{impact.downstreamImpacted.length === 1 ? '' : 's'}:
                </p>
                <ul className="space-y-1">
                  {impact.downstreamImpacted.map((d) => (
                    <li key={d.id} className="text-[12px] flex items-center justify-between gap-2">
                      <Link href={`/tasks/${d.id}/overview`} className="text-foreground hover:underline underline-offset-2 truncate">
                        {d.taskCode} — {d.taskName}
                      </Link>
                      <span className="text-muted-foreground flex-shrink-0">{d.totalDelayDays}d</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Link
              href={`/tasks/${row!.id}/overview`}
              className="inline-flex items-center gap-1 text-[12.5px] font-medium text-foreground underline underline-offset-2 hover:no-underline"
            >
              View full task →
            </Link>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
