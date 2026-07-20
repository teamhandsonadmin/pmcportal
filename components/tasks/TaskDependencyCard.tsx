'use client';

import { useMemo, useState, useTransition } from 'react';
import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TaskStatusBadge } from '@/components/tasks/TaskStatusBadge';
import { addTaskDependency, removeTaskDependency } from '@/app/actions/task-dependencies';
import type { TaskDependencyContextItem } from '@/app/actions/task-dependencies';
import type { ActionResult } from '@/lib/types/tasks';

const initialState: ActionResult = { success: true };

interface TaskDependencyCardProps {
  taskId: string;
  prerequisites: (TaskDependencyContextItem & { dependencyId: string })[];
  candidateTasks: TaskDependencyContextItem[];
  locked: boolean;
}

export function TaskDependencyCard({ taskId, prerequisites, candidateTasks, locked }: TaskDependencyCardProps) {
  const [state, formAction, isPending] = useActionState(addTaskDependency, initialState);
  const [search, setSearch] = useState('');

  const incompleteCount = prerequisites.filter((p) => p.status !== 'completed').length;

  const filteredCandidates = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return candidateTasks;
    return candidateTasks.filter(
      (t) => t.taskName.toLowerCase().includes(q) || t.taskId.toLowerCase().includes(q)
    );
  }, [candidateTasks, search]);

  const globalError = !state.success && typeof state.error === 'string' ? state.error : null;

  return (
    <div className="space-y-3">
      {incompleteCount > 0 && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-[12.5px] text-amber-800">
          This task cannot move to In Progress until {incompleteCount} prerequisite task{incompleteCount === 1 ? '' : 's'} {incompleteCount === 1 ? 'is' : 'are'} completed.
        </div>
      )}

      {prerequisites.length === 0 ? (
        <p className="text-[12.5px] text-muted-foreground">No prerequisite tasks set.</p>
      ) : (
        <div className="space-y-1.5">
          {prerequisites.map((p) => (
            <PrerequisiteRow key={p.dependencyId} prerequisite={p} locked={locked} />
          ))}
        </div>
      )}

      {!locked && (
        <form action={formAction} className="pt-2 border-t border-border space-y-2">
          <input type="hidden" name="taskId" value={taskId} />

          {globalError && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-600">
              {globalError}
            </div>
          )}

          <Input
            type="text"
            placeholder="Search tasks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-[12.5px]"
          />
          <div className="flex gap-2">
            <select
              name="dependsOnTaskId"
              defaultValue=""
              required
              className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
              <option value="" disabled>Select a prerequisite task…</option>
              {filteredCandidates.map((t) => (
                <option key={t.id} value={t.id}>{t.taskId} — {t.taskName} ({t.workCode})</option>
              ))}
            </select>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? 'Adding…' : 'Add'}
            </Button>
          </div>
          {candidateTasks.length === 0 && (
            <p className="text-[11px] text-muted-foreground">No other tasks available to depend on.</p>
          )}
        </form>
      )}
    </div>
  );
}

function PrerequisiteRow({
  prerequisite,
  locked,
}: {
  prerequisite: TaskDependencyContextItem & { dependencyId: string };
  locked: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div
      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border"
      style={{ opacity: isPending ? 0.5 : 1 }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Link href={`/tasks/${prerequisite.id}`} className="text-[12.5px] font-medium truncate hover:underline">
          {prerequisite.taskId} — {prerequisite.taskName}
        </Link>
        <span className="text-[10.5px] text-muted-foreground flex-shrink-0">{prerequisite.workCode}</span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <TaskStatusBadge status={prerequisite.status} />
        {!locked && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => { removeTaskDependency(prerequisite.dependencyId); })}
            className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-red-500 rounded hover:bg-red-50 transition-colors"
            aria-label="Remove dependency"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
