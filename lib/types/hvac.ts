export type TaskStatus =
  | 'draft'
  | 'ready'
  | 'in_progress'
  | 'on_hold'
  | 'blocked'
  | 'completed';

export type DependencyCategory =
  | 'architect'
  | 'client'
  | 'consultant'
  | 'contractor'
  | 'inspector';

export type CompletionStatus = 'pending' | 'delivered' | 'not_required';

export const CATEGORY_COLORS: Record<DependencyCategory, {
  border: string; bg: string; text: string; badge: string; dot: string;
}> = {
  architect:  { border: '#4F46E5', bg: '#EEF2FF', text: '#4338CA', badge: '#C7D2FE', dot: '#6366F1' },
  client:     { border: '#059669', bg: '#ECFDF5', text: '#047857', badge: '#A7F3D0', dot: '#10B981' },
  consultant: { border: '#D97706', bg: '#FFFBEB', text: '#B45309', badge: '#FDE68A', dot: '#F59E0B' },
  contractor: { border: '#7C3AED', bg: '#F5F3FF', text: '#6D28D9', badge: '#DDD6FE', dot: '#8B5CF6' },
  inspector:  { border: '#0891B2', bg: '#ECFEFF', text: '#0E7490', badge: '#CFFAFE', dot: '#06B6D4' },
};

export interface Work {
  id: string;
  name: string;
  code: string;
  description: string | null;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface HvacTask {
  id: string;
  taskId: string;
  taskName: string;
  projectName: string;
  description: string | null;
  status: TaskStatus;
  createdBy: string | null;
  workId: string | null;
  createdAt: Date;
  dueDate: Date | null;
  updatedAt: Date;
}

export interface DependencyCompletion {
  id: string;
  itemId: string;
  status: CompletionStatus;
  comment: string | null;
  completedBy: string | null;
  completedAt: Date | null;
  updatedAt: Date;
}

export interface DependencyItem {
  id: string;
  taskId: string;
  category: DependencyCategory;
  itemLabel: string;
  isMandatory: boolean;
  sortOrder: number;
  createdAt: Date;
  completion?: DependencyCompletion | null;
}

export interface CategoryProgress {
  taskId: string;
  category: DependencyCategory;
  totalItems: number;
  completedItems: number;
  completionPct: number;
  categoryComplete: boolean;
}

export interface ActivityEvent {
  id: string;
  taskId: string;
  userId: string | null;
  actionType: 'status_change' | 'checklist_update' | 'comment' | 'task_created';
  payload: Record<string, unknown> | null;
  createdAt: Date;
}

export interface DashboardStats {
  readyCount: number;
  inProgressCount: number;
  blockedCount: number;
  completedCount: number;
  totalCount: number;
}

export interface Holiday {
  id: string;
  date: Date;
  name: string;
  description: string | null;
  createdAt: Date;
}

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string | Record<string, string[]> };

export function isItemDone(status: CompletionStatus | undefined): boolean {
  return status === 'delivered' || status === 'not_required';
}
