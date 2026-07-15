'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { WorkingDayPicker } from '@/components/ui/working-day-picker';
import { TaskTypeManager, type TaskTypeOption } from '@/components/hvac/TaskTypeManager';
import { createHvacTask } from '@/app/actions/hvac-tasks';
import { computeDueDate } from '@/app/actions/working-days';
import { formatDateKey } from '@/lib/utils/format';
import type { ActionResult } from '@/lib/types/hvac';

const initialState: ActionResult<{ taskId: string }> = { success: true };

interface AssignableUser {
  id: string;
  fullName: string;
  role: string;
}

interface TaskFormProps {
  workId: string;
  assignableUsers: AssignableUser[];
  taskTypes: TaskTypeOption[];
}

const ROLE_LABEL: Record<string, string> = {
  site_engineer: 'Site Engineer',
  senior_site_engineer: 'Sr. Site Engineer',
};

export function TaskForm({ workId, assignableUsers, taskTypes: initialTaskTypes }: TaskFormProps) {
  const [state, formAction, isPending] = useActionState(createHvacTask, initialState);
  const [taskTypes, setTaskTypes] = useState(initialTaskTypes);
  const [plannedStart, setPlannedStart] = useState<Date | undefined>();
  const [taskTypeId, setTaskTypeId] = useState('');
  const [suggestedDueDate, setSuggestedDueDate] = useState<string | undefined>();

  const errors = (!state.success && typeof state.error === 'object') ? state.error : {};
  const globalError = !state.success && typeof state.error === 'string' ? state.error : null;

  // Auto-suggests the Planned End Date once both a Task Type and a Planned
  // Start Date are set — still fully overridable by the user afterward
  // (WorkingDayPicker treats `value` as a suggestion, not a lock).
  const plannedStartKey = plannedStart ? formatDateKey(plannedStart) : undefined;
  useEffect(() => {
    if (!taskTypeId || !plannedStartKey) return;
    const type = taskTypes.find((t) => t.id === taskTypeId);
    if (!type) return;
    let cancelled = false;
    computeDueDate(plannedStartKey, type.defaultDurationDays).then((due) => {
      if (!cancelled) setSuggestedDueDate(due);
    });
    return () => { cancelled = true; };
  }, [taskTypeId, plannedStartKey, taskTypes]);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="work_id" value={workId} />

      {globalError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-[13px] text-red-600">
          {globalError}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="task_name">Task Name</Label>
        <Input
          id="task_name"
          name="task_name"
          placeholder="e.g. Level 3 Ductwork Installation"
          required
        />
        {errors.task_name && (
          <p className="text-xs text-red-500">{errors.task_name[0]}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">
          Description <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="description"
          name="description"
          placeholder="Describe the scope of work…"
          rows={3}
          className="resize-none"
        />
        {errors.description && (
          <p className="text-xs text-red-500">{errors.description[0]}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="task_type_id">
            Task Type <span className="text-muted-foreground">(optional)</span>
          </Label>
          <TaskTypeManager taskTypes={taskTypes} onChange={setTaskTypes} />
        </div>
        <select
          id="task_type_id"
          name="task_type_id"
          value={taskTypeId}
          onChange={(e) => setTaskTypeId(e.target.value)}
          className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        >
          <option value="">No type</option>
          {taskTypes.map((t) => (
            <option key={t.id} value={t.id}>{t.name} — {t.defaultDurationDays} working days</option>
          ))}
        </select>
        <p className="text-[11px] text-muted-foreground">
          Selecting a type suggests a Planned End Date once a Planned Start Date is set — still fully editable.
        </p>
      </div>

      {/* Planned dates — the forward-looking schedule commitment, so Sundays/holidays are disabled. */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Planned</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="planned_start_date">
              Start Date <span className="text-muted-foreground">(optional)</span>
            </Label>
            <WorkingDayPicker
              id="planned_start_date"
              name="planned_start_date"
              placeholder="Pick a start date"
              onDateChange={setPlannedStart}
            />
            {errors.planned_start_date && (
              <p className="text-xs text-red-500">{errors.planned_start_date[0]}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="due_date">
              End Date <span className="text-muted-foreground">(optional)</span>
            </Label>
            <WorkingDayPicker
              id="due_date"
              name="due_date"
              placeholder="Pick an end date"
              minDate={plannedStart}
              value={suggestedDueDate}
            />
            {errors.due_date && (
              <p className="text-xs text-red-500">{errors.due_date[0]}</p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="total_sft">
          Total SFT (sq. ft.) <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input id="total_sft" name="total_sft" type="number" step="0.01" min="0" placeholder="e.g. 1200" />
        {errors.total_sft && (
          <p className="text-xs text-red-500">{errors.total_sft[0]}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="assigned_to">
          Assign to Site Engineer <span className="text-muted-foreground">(optional)</span>
        </Label>
        {assignableUsers.length > 0 ? (
          <select
            id="assigned_to"
            name="assigned_to"
            defaultValue=""
            className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          >
            <option value="">Unassigned</option>
            {assignableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName} — {ROLE_LABEL[u.role] ?? u.role}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-muted-foreground">
            No site engineers yet — add one via{' '}
            <a href="/access" className="underline hover:text-foreground">
              Access &amp; Roles
            </a>{' '}
            to assign tasks.
          </p>
        )}
        {errors.assigned_to && (
          <p className="text-xs text-red-500">{errors.assigned_to[0]}</p>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Creating…' : 'Create Task'}
        </Button>
        <Button type="button" variant="outline" onClick={() => history.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
