import type { TaskStatus, DependencyType } from '@/lib/types/tasks';

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
  actualStartDate: Date | null;
  workCode?: string;
}

export interface TypedPrerequisite {
  type: DependencyType;
  task: PrerequisiteTask;
}

export interface UnmetPrerequisite {
  task: PrerequisiteTask;
  type: DependencyType;
  reason: string;
}

export const DEPENDENCY_TYPE_LABELS: Record<DependencyType, string> = {
  FS: 'Finish-to-Start',
  SS: 'Start-to-Start',
  FF: 'Finish-to-Finish',
  SF: 'Start-to-Finish',
};

// Which condition to check for each type, and per the model's own meaning:
// FS/FF care about the prerequisite reaching `completed`; SS/SF care about
// it having genuinely STARTED (actualStartDate set — the real ground-truth
// signal, not just "status isn't draft/ready"). Exported so any other
// consumer that needs "is this specific typed dependency satisfied" (e.g.
// the flowchart's prerequisite-count badge in lib/data/works.ts) uses the
// exact same definition as the actual gating logic below, rather than a
// second, potentially-drifting copy of this rule.
export function isDependencySatisfied(type: DependencyType, task: PrerequisiteTask): boolean {
  return type === 'FS' || type === 'FF' ? task.status === 'completed' : !!task.actualStartDate;
}
function unmetReason(type: DependencyType): string {
  return type === 'FS' || type === 'FF' ? 'has not completed yet' : 'has not started yet';
}

// Gates entering `in_progress` — only FS/SS-type links constrain STARTING.
// An FF/SF-type prerequisite never blocks this task from starting (see
// DependencyType's own doc comment in prisma/schema.prisma) — it only ever
// constrains this task's own finish, checked separately below.
export function getStartBlockingPrerequisites(prereqs: TypedPrerequisite[]): UnmetPrerequisite[] {
  return prereqs
    .filter((p) => p.type === 'FS' || p.type === 'SS')
    .filter((p) => !isDependencySatisfied(p.type, p.task))
    .map((p) => ({ task: p.task, type: p.type, reason: unmetReason(p.type) }));
}

// Gates entering `completed` — only FF/SF-type links constrain FINISHING.
// FS/SS links already gated this task's start and are not re-checked here —
// once a task is allowed to start, an FS/SS prerequisite has nothing further
// to say about when it's allowed to finish.
export function getFinishBlockingPrerequisites(prereqs: TypedPrerequisite[]): UnmetPrerequisite[] {
  return prereqs
    .filter((p) => p.type === 'FF' || p.type === 'SF')
    .filter((p) => !isDependencySatisfied(p.type, p.task))
    .map((p) => ({ task: p.task, type: p.type, reason: unmetReason(p.type) }));
}

export function formatUnmetPrerequisites(unmet: UnmetPrerequisite[]): string {
  return unmet.map((u) => `'${u.task.taskName}' (${DEPENDENCY_TYPE_LABELS[u.type]}) ${u.reason}`).join('; ');
}
