import type { TaskStatus } from '@/lib/types/hvac';

export const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  draft:       [],
  ready:       ['in_progress'],
  in_progress: ['on_hold', 'completed'],
  on_hold:     ['in_progress'],
  blocked:     [],
  completed:   [],
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  draft:       'Draft',
  ready:       'Ready',
  in_progress: 'In Progress',
  on_hold:     'On Hold',
  blocked:     'Blocked',
  completed:   'Completed',
};

export const TRANSITION_LABELS: Partial<Record<TaskStatus, string>> = {
  in_progress: 'Start Task',
  on_hold:     'Put On Hold',
  completed:   'Mark Complete',
};

export function allowedTransitions(status: TaskStatus): TaskStatus[] {
  return VALID_TRANSITIONS[status] ?? [];
}

export function isLocked(status: TaskStatus): boolean {
  return status === 'completed';
}

export function canEdit(status: TaskStatus): boolean {
  return status !== 'completed';
}

export interface PrerequisiteTask {
  id: string;
  taskId: string;
  taskName: string;
  status: TaskStatus;
  workCode?: string;
}

// Pure filter over already-fetched prerequisite tasks — this file has no I/O
// today and stays that way; the Prisma fetch happens in the caller (see
// updateTaskStatus in app/actions/hvac-tasks.ts).
export function getBlockingPrerequisites(prerequisites: PrerequisiteTask[]): PrerequisiteTask[] {
  return prerequisites.filter((p) => p.status !== 'completed');
}
