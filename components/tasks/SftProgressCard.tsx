'use client';

import { useState, useTransition } from 'react';
import { useActionState } from 'react';
import { addSftEntry, deleteSftEntry, updateTaskTotalSft } from '@/app/actions/sft';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { formatDate } from '@/lib/utils/format';
import type { ActionResult } from '@/lib/types/tasks';

interface SftEntry {
  id: string;
  entryDate: Date | string;
  sftCompleted: number;
  headcount: number | null;
  notes: string | null;
}

interface SftProgressCardProps {
  taskId: string;
  totalSft: number | null;
  entries: SftEntry[];
  locked: boolean;
}

const initialState: ActionResult = { success: true };

const gridCols = '110px 90px 90px 1fr 32px';

export function SftProgressCard({ taskId, totalSft, entries, locked }: SftProgressCardProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(addSftEntry, initialState);
  const [lastHandledState, setLastHandledState] = useState(state);

  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state.success && open) setOpen(false);
  }

  const cumulative = entries.reduce((sum, e) => sum + e.sftCompleted, 0);
  const pct = totalSft ? Math.min(100, Math.round((cumulative / totalSft) * 100)) : 0;

  const errors = (!state.success && typeof state.error === 'object') ? state.error : {};
  const globalError = !state.success && typeof state.error === 'string' ? state.error : null;

  return (
    <div className="border border-border rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          SFT Progress
        </h2>
        {!locked && (
          <Dialog open={open} onOpenChange={setOpen}>
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
              + Log Entry
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Log SFT Entry</DialogTitle>
              </DialogHeader>
              <form action={formAction} className="space-y-4 mt-2">
                <input type="hidden" name="taskId" value={taskId} />

                {globalError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-[13px] text-red-600">
                    {globalError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="entryDate">Date</Label>
                    <Input
                      id="entryDate"
                      name="entryDate"
                      type="date"
                      defaultValue={new Date().toISOString().slice(0, 10)}
                      required
                    />
                    {errors.entryDate && <p className="text-xs text-red-500">{errors.entryDate[0]}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sftCompleted">SFT Completed</Label>
                    <Input id="sftCompleted" name="sftCompleted" type="number" step="0.01" min="0" required />
                    {errors.sftCompleted && <p className="text-xs text-red-500">{errors.sftCompleted[0]}</p>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="headcount">
                    Headcount <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input id="headcount" name="headcount" type="number" step="1" min="0" placeholder="Workers on site" />
                  {errors.headcount && <p className="text-xs text-red-500">{errors.headcount[0]}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="notes">
                    Notes <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Textarea id="notes" name="notes" rows={2} className="resize-none" />
                  {errors.notes && <p className="text-xs text-red-500">{errors.notes[0]}</p>}
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={isPending}>
                    {isPending ? 'Saving…' : 'Save Entry'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {totalSft == null ? (
        <SetTargetInline taskId={taskId} disabled={locked} />
      ) : (
        <>
          <div className="flex items-end justify-between mb-2">
            <div>
              <span className="text-2xl font-bold tabular-nums">{cumulative}</span>
              <span className="text-sm text-muted-foreground"> / {totalSft} sq. ft.</span>
            </div>
            <span className="text-sm font-semibold tabular-nums">{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-4">
            <div className="h-full rounded-full bg-foreground" style={{ width: `${pct}%` }} />
          </div>
        </>
      )}

      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">No SFT entries logged yet.</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden mt-2">
          <div
            className="grid px-3 py-2 bg-muted/50 border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
            style={{ gridTemplateColumns: gridCols }}
          >
            <span>Date</span>
            <span>SFT</span>
            <span>Workers</span>
            <span>Notes</span>
            <span />
          </div>
          <div className="divide-y divide-border">
            {entries.map((entry) => (
              <SftEntryRow key={entry.id} entry={entry} locked={locked} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SftEntryRow({ entry, locked }: { entry: SftEntry; locked: boolean }) {
  const [isDeleting, startTransition] = useTransition();

  return (
    <div
      className="grid items-center px-3 py-2 text-[12.5px]"
      style={{ gridTemplateColumns: gridCols, opacity: isDeleting ? 0.5 : 1 }}
    >
      <span className="font-mono text-muted-foreground">{formatDate(entry.entryDate)}</span>
      <span className="font-semibold tabular-nums">{entry.sftCompleted}</span>
      <span className="tabular-nums text-muted-foreground">{entry.headcount ?? '—'}</span>
      <span className="text-muted-foreground truncate">{entry.notes ?? '—'}</span>
      {!locked && (
        <button
          type="button"
          disabled={isDeleting}
          onClick={() => startTransition(() => { deleteSftEntry(entry.id); })}
          className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-red-500 rounded hover:bg-red-50 transition-colors"
          aria-label="Delete entry"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}

function SetTargetInline({ taskId, disabled }: { taskId: string; disabled: boolean }) {
  const [value, setValue] = useState('');
  const [isPending, startTransition] = useTransition();

  if (disabled) {
    return <p className="text-xs text-muted-foreground py-2">No SFT target set.</p>;
  }

  return (
    <div className="flex items-end gap-2 mb-4">
      <div className="space-y-1.5 flex-1">
        <Label htmlFor="set_total_sft" className="text-xs">Total SFT target not set</Label>
        <Input
          id="set_total_sft"
          type="number"
          step="0.01"
          min="0"
          placeholder="e.g. 1200"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <Button
        type="button"
        size="sm"
        disabled={isPending || !value}
        onClick={() => startTransition(() => { updateTaskTotalSft(taskId, Number(value)); })}
      >
        Set Target
      </Button>
    </div>
  );
}
