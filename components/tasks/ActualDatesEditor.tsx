'use client';

import { useState, useTransition } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { updateTaskActualDate } from '@/app/actions/tasks';
import { formatDate } from '@/lib/utils/format';

interface ActualDateFieldProps {
  taskId: string;
  field: 'actualStartDate' | 'actualEndDate';
  label: string;
  value: Date | null;
  placeholder: string; // shown before the relevant status transition has happened
}

// One field at a time (not a combined dialog like PlannedDatesEditor) since
// each actual date is captured by a different, independent event
// (transitioning into in_progress vs. into completed) — editing one has
// nothing to do with the other. Deliberately a plain date input, not
// WorkingDayPicker: an actual event can genuinely have happened on a Sunday
// or a holiday, so the working-day restriction that applies to planned
// dates would be actively wrong here.
export function ActualDateField({ taskId, field, label, value, placeholder }: ActualDateFieldProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState(value ? value.toISOString().slice(0, 10) : '');
  const [error, setError] = useState<string | null>(null);

  function openDialog() {
    setDraft(value ? value.toISOString().slice(0, 10) : '');
    setError(null);
    setOpen(true);
  }

  function save() {
    startTransition(async () => {
      const res = await updateTaskActualDate(taskId, field, draft || null);
      if (!res.success) {
        setError(typeof res.error === 'string' ? res.error : 'Failed to save');
        return;
      }
      setOpen(false);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <Dialog open={open} onOpenChange={(next) => (next ? openDialog() : setOpen(false))}>
          <DialogTrigger
            render={
              <button type="button" className="text-[10.5px] text-muted-foreground hover:text-foreground underline underline-offset-2">
                {value ? 'Edit' : 'Set'}
              </button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{label}</DialogTitle>
              <DialogDescription>
                A record of what actually happened, not a plan — any date is allowed, including
                weekends/holidays. Changes are logged to this task&apos;s activity history.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="mt-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-600">{error}</div>
            )}

            <div className="mt-3 space-y-1.5">
              <Label htmlFor={`actual-date-${field}`}>{label}</Label>
              <input
                id={`actual-date-${field}`}
                type="date"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-[13px] text-foreground shadow-none transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <DialogFooter>
              {value && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setDraft(''); }}
                  disabled={isPending}
                  className="mr-auto"
                >
                  Clear
                </Button>
              )}
              <DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />
              <Button type="button" onClick={save} disabled={isPending}>{isPending ? 'Saving…' : 'Save'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <dd className="text-sm font-mono">{value ? formatDate(value) : <span className="text-muted-foreground/60 italic">{placeholder}</span>}</dd>
    </div>
  );
}
