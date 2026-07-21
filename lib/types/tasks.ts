export type TaskStatus =
  | 'draft'
  | 'ready'
  | 'in_progress'
  | 'on_hold'
  | 'blocked'
  | 'completed';

// Finish-to-Start / Start-to-Start / Finish-to-Finish / Start-to-Finish —
// the four standard PM dependency types. FS is the only one that has ever
// existed in this app; every existing TaskDependency row defaults to it.
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

// 'inspector' (displayed as "Vendor" in some UIs) was retired as a checklist
// category — its one surviving item, Material Samples, moved under
// 'procurement', and no DependencyItem/DependencyTemplateItem row references
// it anymore. It stays in this union (and every Record<DependencyCategory,
// ...> below) because it's still a live value in the Prisma-generated enum —
// recreating that Postgres enum type to drop it is a riskier migration than
// just never surfacing it. Every CATEGORIES list/iteration array across the
// app (the thing that actually controls what renders) omits it instead.
export type DependencyCategory =
  | 'architect'
  | 'client'
  | 'consultant'
  | 'contractor'
  | 'inspector'
  | 'procurement'
  | 'quantity';

export type CompletionStatus = 'YES' | 'NO' | 'ON_HOLD' | 'PENDING' | 'REVISIONS' | 'PROCEED';

export type QuantityUnit =
  | 'ROOM_AREA_WISE'
  | 'RFT'
  | 'SFT'
  | 'CFT'
  | 'SQM'
  | 'NO'
  | 'RMTS'
  | 'TARGETED_QUANTITY_OF_WORK';

// Fixed 8-option list, exact labels/order as specified by the client — not
// alphabetized. Every DependencyItem gets this field regardless of category
// (even ones with no obvious quantity, like "Design Intent") — a deliberate,
// generic field some items just won't use.
export const QUANTITY_UNIT_LABEL: Record<QuantityUnit, string> = {
  ROOM_AREA_WISE: 'Room/Area-wise',
  RFT: 'RFT',
  SFT: 'SFT',
  CFT: 'CFT',
  SQM: 'Sqm',
  NO: 'No',
  RMTS: 'RMTS',
  TARGETED_QUANTITY_OF_WORK: 'Targeted Quantity of work',
};

export const QUANTITY_UNIT_ORDER: QuantityUnit[] = [
  'ROOM_AREA_WISE', 'RFT', 'SFT', 'CFT', 'SQM', 'NO', 'RMTS', 'TARGETED_QUANTITY_OF_WORK',
];

export type InventoryUnit =
  | 'PCS'
  | 'KG'
  | 'TON'
  | 'BAG'
  | 'LITRE'
  | 'SQFT'
  | 'CUBIC_M'
  | 'BOX'
  | 'ROLL'
  | 'OTHER';

export type InventoryTransactionType = 'IN' | 'OUT' | 'ADJUSTMENT';

export const CATEGORY_COLORS: Record<DependencyCategory, {
  border: string; bg: string; text: string; badge: string; dot: string;
}> = {
  architect:  { border: '#4F46E5', bg: '#EEF2FF', text: '#4338CA', badge: '#C7D2FE', dot: '#6366F1' },
  client:     { border: '#059669', bg: '#ECFDF5', text: '#047857', badge: '#A7F3D0', dot: '#10B981' },
  consultant: { border: '#D97706', bg: '#FFFBEB', text: '#B45309', badge: '#FDE68A', dot: '#F59E0B' },
  contractor: { border: '#7C3AED', bg: '#F5F3FF', text: '#6D28D9', badge: '#DDD6FE', dot: '#8B5CF6' },
  inspector:  { border: '#0891B2', bg: '#ECFEFF', text: '#0E7490', badge: '#CFFAFE', dot: '#06B6D4' },
  procurement: { border: '#B45309', bg: '#FFF7ED', text: '#9A3412', badge: '#FED7AA', dot: '#F97316' },
  quantity:   { border: '#BE185D', bg: '#FDF2F8', text: '#9D174D', badge: '#FBCFE8', dot: '#EC4899' },
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

export interface Task {
  id: string;
  taskId: string;
  taskName: string;
  projectName: string;
  description: string | null;
  status: TaskStatus;
  createdBy: string | null;
  assignedTo: string | null;
  workId: string | null;
  totalSft: number | null;
  createdAt: Date;
  plannedStartDate: Date | null;
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
  // Real threaded comment count (see the Comment model) — optional since not
  // every consumer of this type fetches it; the checklist UIs do, to badge
  // the comment icon.
  commentCount?: number;
  quantityUnit?: QuantityUnit | null;
  quantityValue?: number | null;
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
  actionType:
    | 'status_change'
    | 'checklist_update'
    | 'comment'
    | 'task_created'
    | 'sft_progress_logged'
    | 'sft_progress_deleted'
    | 'sft_target_updated'
    | 'inventory_item_created'
    | 'inventory_transaction_recorded'
    | 'inventory_ocr_intake'
    | 'planned_dates_updated';
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

export type HolidayType = 'national_holiday' | 'festival_holiday' | 'regional_holiday' | 'company_shutdown';

export interface Holiday {
  id: string;
  date: Date;
  name: string;
  type: HolidayType;
  description: string | null;
  createdAt: Date;
}

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string | Record<string, string[]> };

// "Clears" states — the item is done and doesn't block its task from
// reaching "ready". Every other status (NO/ON_HOLD/PENDING/REVISIONS) blocks.
export function isItemDone(status: CompletionStatus | undefined): boolean {
  return status === 'YES' || status === 'PROCEED';
}
