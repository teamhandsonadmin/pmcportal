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
  blocked:     'Not Started',
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

// Consolidated 3-color (+ neutral) status grouping, for dense displays where a
// distinct color per TaskStatus value is too much visual noise (e.g. the
// flowchart graph at 60-80+ nodes). This does NOT replace TaskStatus or any
// of the 6-value logic above — it's a display-only grouping, applied
// wherever a component opts into it via getStatusColorGroup/STATUS_COLOR_PALETTE.
// Scope note: as of this change, only components/tasks/TaskDependencyGraph.tsx
// uses this — TaskStatusBadge.tsx, TrelloTaskDetail.tsx, and TaskFlowMap.tsx
// still render their own full 6-color schemes, left untouched pending a
// decision on whether to consolidate those too.
export type StatusColorGroup = 'gray' | 'amber' | 'red' | 'green';

export const STATUS_COLOR_GROUP: Record<TaskStatus, StatusColorGroup> = {
  draft:       'gray',
  ready:       'amber',
  in_progress: 'amber',
  on_hold:     'amber',
  blocked:     'red',
  completed:   'green',
};

export const STATUS_COLOR_PALETTE: Record<StatusColorGroup, { bg: string; border: string; text: string; dot: string }> = {
  gray:  { bg: '#F9FAFB', border: '#E5E7EB', text: '#6B7280', dot: '#9CA3AF' },
  amber: { bg: '#FFFBEB', border: '#FDE68A', text: '#B45309', dot: '#F59E0B' },
  red:   { bg: '#FEF2F2', border: '#FECACA', text: '#DC2626', dot: '#EF4444' },
  green: { bg: '#F0FDF4', border: '#BBF7D0', text: '#15803D', dot: '#22C55E' },
};

export function getStatusColor(status: TaskStatus) {
  return STATUS_COLOR_PALETTE[STATUS_COLOR_GROUP[status]];
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
