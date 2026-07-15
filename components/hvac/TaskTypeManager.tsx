'use client';

import { useState, useTransition } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createTaskType, deleteTaskType, updateTaskType } from '@/app/actions/task-types';

export interface TaskTypeOption {
  id: string;
  name: string;
  defaultDurationDays: number;
}

const BLANK_FORM = { name: '', defaultDurationDays: '' };

// Inline management, not a dedicated settings page — matches how the rest of
// this app handles small reference-data CRUD (see DependencyTemplateEditor).
// Local state is updated directly on success so the *currently open* task
// creation form's Task Type dropdown reflects changes immediately, without
// waiting on a route revalidation the in-progress form wouldn't pick up
// anyway (it already rendered with the old props).
export function TaskTypeManager({
  taskTypes,
  onChange,
}: {
  taskTypes: TaskTypeOption[];
  onChange: (next: TaskTypeOption[]) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [error, setError] = useState('');

  function startAdd() {
    setEditId('new');
    setForm(BLANK_FORM);
    setError('');
  }
  function startEdit(t: TaskTypeOption) {
    setEditId(t.id);
    setForm({ name: t.name, defaultDurationDays: String(t.defaultDurationDays) });
    setError('');
  }
  function cancel() {
    setEditId(null);
    setForm(BLANK_FORM);
    setError('');
  }

  function save() {
    const name = form.name.trim();
    const days = Number(form.defaultDurationDays);
    if (!name || !Number.isFinite(days) || days < 1) {
      setError('Enter a name and a duration of at least 1 working day.');
      return;
    }

    startTransition(async () => {
      if (editId === 'new') {
        const res = await createTaskType({ name, defaultDurationDays: days });
        if (!res.success) { setError(typeof res.error === 'string' ? res.error : 'Failed to save.'); return; }
        onChange([...taskTypes, { id: res.data!.id, name, defaultDurationDays: days }].sort((a, b) => a.name.localeCompare(b.name)));
      } else if (editId) {
        const res = await updateTaskType(editId, { name, defaultDurationDays: days });
        if (!res.success) { setError(typeof res.error === 'string' ? res.error : 'Failed to save.'); return; }
        onChange(taskTypes.map((t) => (t.id === editId ? { ...t, name, defaultDurationDays: days } : t)));
      }
      cancel();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteTaskType(id);
      if (!res.success) { setError(typeof res.error === 'string' ? res.error : 'Failed to delete.'); return; }
      onChange(taskTypes.filter((t) => t.id !== id));
    });
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <button type="button" className="text-[11.5px] text-muted-foreground hover:text-foreground underline underline-offset-2">
            Manage Task Types
          </button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Task Types</DialogTitle>
          <DialogDescription>
            Default durations used to auto-suggest a due date from a planned start date.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="mt-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-600">{error}</div>
        )}

        <div className="mt-3 space-y-1.5 max-h-[45vh] overflow-y-auto pr-1">
          {taskTypes.map((t) => (
            editId === t.id ? (
              <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg border border-border">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" className="flex-1" />
                <Input
                  type="number" min={1}
                  value={form.defaultDurationDays}
                  onChange={(e) => setForm({ ...form, defaultDurationDays: e.target.value })}
                  placeholder="Days" className="w-24"
                />
                <Button type="button" size="sm" onClick={save} disabled={isPending}>Save</Button>
                <Button type="button" size="sm" variant="ghost" onClick={cancel}>Cancel</Button>
              </div>
            ) : (
              <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/60 group">
                <span className="flex-1 text-[13px] font-medium">{t.name}</span>
                <span className="text-[12px] text-muted-foreground font-mono">{t.defaultDurationDays}d</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" onClick={() => startEdit(t)} className="text-[11.5px] px-2 py-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">Edit</button>
                  <button type="button" onClick={() => remove(t.id)} disabled={isPending} className="text-[11.5px] px-2 py-1 rounded-md hover:bg-red-50 text-red-500">Delete</button>
                </div>
              </div>
            )
          ))}

          {editId === 'new' && (
            <div className="flex items-center gap-2 p-2 rounded-lg border border-border">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" className="flex-1" autoFocus />
              <Input
                type="number" min={1}
                value={form.defaultDurationDays}
                onChange={(e) => setForm({ ...form, defaultDurationDays: e.target.value })}
                placeholder="Days" className="w-24"
              />
              <Button type="button" size="sm" onClick={save} disabled={isPending}>Add</Button>
              <Button type="button" size="sm" variant="ghost" onClick={cancel}>Cancel</Button>
            </div>
          )}
        </div>

        <DialogFooter className="justify-between">
          {editId === null ? (
            <Button type="button" size="sm" variant="outline" onClick={startAdd}>+ Add Task Type</Button>
          ) : <span />}
          <DialogClose render={<Button type="button" size="sm">Done</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
