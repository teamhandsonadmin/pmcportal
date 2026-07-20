'use client';

import { useState, useTransition } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { WorkingDayPicker } from '@/components/ui/working-day-picker';
import { updateTaskPlannedDates } from '@/app/actions/tasks';
import { formatDateKey } from '@/lib/utils/format';

function parseDateKey(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

interface PlannedDatesEditorProps {
  taskId: string;
  plannedStartDate: string | null; // 'YYYY-MM-DD'
  dueDate: string | null;
}

// Post-creation editing for Planned Start/End Date only — actual dates are
// deferred until the capture mechanism (admin entry vs. a future
// site-engineer mobile screen) is decided, so there's deliberately no UI for
// them here even though the schema columns exist.
export function PlannedDatesEditor({ taskId, plannedStartDate, dueDate }: PlannedDatesEditorProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    plannedStartDate: plannedStartDate ?? '',
    dueDate: dueDate ?? '',
  });
  const [plannedStart, setPlannedStart] = useState<Date | undefined>(
    plannedStartDate ? parseDateKey(plannedStartDate) : undefined
  );
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  function openDialog() {
    setForm({ plannedStartDate: plannedStartDate ?? '', dueDate: dueDate ?? '' });
    setPlannedStart(plannedStartDate ? parseDateKey(plannedStartDate) : undefined);
    setErrors({});
    setOpen(true);
  }

  function save() {
    startTransition(async () => {
      const res = await updateTaskPlannedDates(taskId, {
        plannedStartDate: form.plannedStartDate || null,
        dueDate: form.dueDate || null,
      });
      if (!res.success) {
        setErrors(typeof res.error === 'string' ? { _: [res.error] } : res.error);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? openDialog() : setOpen(false))}>
      <DialogTrigger
        render={
          <button type="button" className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2">
            Edit dates
          </button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Planned Dates</DialogTitle>
          <DialogDescription>Changes are logged to this task&apos;s activity history.</DialogDescription>
        </DialogHeader>

        {errors._ && (
          <div className="mt-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-600">{errors._[0]}</div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Start Date</Label>
            <WorkingDayPicker
              name="edit_planned_start_date"
              defaultValue={form.plannedStartDate || undefined}
              onDateChange={(d) => { setPlannedStart(d); setForm((f) => ({ ...f, plannedStartDate: d ? formatDateKey(d) : '' })); }}
            />
            {errors.planned_start_date && <p className="text-xs text-red-500">{errors.planned_start_date[0]}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>End Date</Label>
            <WorkingDayPicker
              name="edit_due_date"
              defaultValue={form.dueDate || undefined}
              minDate={plannedStart}
              onDateChange={(d) => setForm((f) => ({ ...f, dueDate: d ? formatDateKey(d) : '' }))}
            />
            {errors.due_date && <p className="text-xs text-red-500">{errors.due_date[0]}</p>}
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />
          <Button type="button" onClick={save} disabled={isPending}>{isPending ? 'Saving…' : 'Save Changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
