'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { updateTaskStatus } from '@/app/actions/hvac-tasks';
import { allowedTransitions, TRANSITION_LABELS } from '@/lib/utils/status-rules';
import type { TaskStatus } from '@/lib/types/hvac';

interface TaskStatusControlProps {
  taskId: string;
  currentStatus: TaskStatus;
}

export function TaskStatusControl({ taskId, currentStatus }: TaskStatusControlProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const transitions = allowedTransitions(currentStatus);
  if (!transitions.length) return null;

  function handleTransition(status: TaskStatus) {
    setError(null);
    startTransition(async () => {
      const result = await updateTaskStatus(taskId, status);
      if (!result.success) {
        setError(typeof result.error === 'string' ? result.error : 'Something went wrong');
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 flex-wrap">
        {transitions.map((status) => (
          <Button
            key={status}
            onClick={() => handleTransition(status)}
            disabled={isPending}
            variant={status === 'completed' ? 'default' : 'outline'}
            size="sm"
          >
            {isPending ? 'Updating…' : (TRANSITION_LABELS[status] ?? status)}
          </Button>
        ))}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
