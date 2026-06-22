'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createHvacTask } from '@/app/actions/hvac-tasks';
import type { ActionResult } from '@/lib/types/hvac';

const initialState: ActionResult<{ taskId: string }> = { success: true };

interface TaskFormProps {
  workId: string;
}

export function TaskForm({ workId }: TaskFormProps) {
  const [state, formAction, isPending] = useActionState(createHvacTask, initialState);

  const errors = (!state.success && typeof state.error === 'object') ? state.error : {};
  const globalError = !state.success && typeof state.error === 'string' ? state.error : null;

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
        <Label htmlFor="project_name">Project Name</Label>
        <Input
          id="project_name"
          name="project_name"
          placeholder="e.g. Tower A — Commercial"
          required
        />
        {errors.project_name && (
          <p className="text-xs text-red-500">{errors.project_name[0]}</p>
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
        <Label htmlFor="due_date">
          Due Date <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input id="due_date" name="due_date" type="date" />
        {errors.due_date && (
          <p className="text-xs text-red-500">{errors.due_date[0]}</p>
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
