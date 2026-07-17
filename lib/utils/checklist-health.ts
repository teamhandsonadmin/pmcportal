import type { CompletionStatus, DependencyCategory } from '@/lib/types/hvac';

// Worst-to-best — mirrors the Gantt "checklist health" spec: an active
// problem (No, On Hold) always outranks a merely-unresolved one (Pending),
// which in turn outranks anything already clearing the item (Proceed, Yes).
// Index 0 is the worst possible status.
export const CHECKLIST_SEVERITY_ORDER: CompletionStatus[] = [
  'NO',
  'ON_HOLD',
  'REVISIONS',
  'PENDING',
  'PROCEED',
  'YES',
];

const SEVERITY_RANK: Record<CompletionStatus, number> = Object.fromEntries(
  CHECKLIST_SEVERITY_ORDER.map((status, i) => [status, i])
) as Record<CompletionStatus, number>;

// null means the task has no checklist items at all (shouldn't happen in
// practice — every task gets the template seeded on creation — but a task
// genuinely without any items has no "health" to report, not a false clean
// bill of health).
export function worstChecklistStatus(statuses: CompletionStatus[]): CompletionStatus | null {
  if (statuses.length === 0) return null;
  return statuses.reduce((worst, s) => (SEVERITY_RANK[s] < SEVERITY_RANK[worst] ? s : worst), statuses[0]);
}

// Fixed display order — NOT insertion order from whatever order items
// happen to arrive in (which would vary task to task and reorder the boxes
// unpredictably as an admin scans down the Gantt). Mirrors the mobile app's
// own CATEGORY_ORDER exactly (site-engineer-app/lib/checklistHealth.ts) so
// the same task's checklist-health boxes appear in the same left-to-right
// order on both.
export const CHECKLIST_CATEGORY_ORDER: DependencyCategory[] = [
  'architect', 'client', 'consultant', 'contractor', 'inspector', 'procurement',
];

export interface ChecklistHealthItem {
  category: DependencyCategory;
  itemLabel: string;
  status: CompletionStatus;
}

export interface CategoryHealth {
  category: DependencyCategory;
  status: CompletionStatus; // worst status among this category's own items
  items: ChecklistHealthItem[];
}

// One entry per category that actually HAS items on this task (max 6, per
// CHECKLIST_CATEGORY_ORDER) — a category with zero items is simply absent
// from the result, not rendered as an empty/placeholder box. Each entry
// carries its own item list so a hover/tap can show just that category's
// breakdown without a second fetch or re-filtering the full list again.
// Ports the mobile app's checklistHealthByCategory (the design this
// replaced the old single combined "worst status dot" with) so admin-web's
// two Gantt views (the internal /gantt board and the client report's
// Timeline) show the exact same per-category boxes mobile does.
export function checklistHealthByCategory(items: ChecklistHealthItem[]): CategoryHealth[] {
  const byCategory = new Map<DependencyCategory, ChecklistHealthItem[]>();
  for (const item of items) {
    if (!byCategory.has(item.category)) byCategory.set(item.category, []);
    byCategory.get(item.category)!.push(item);
  }
  return CHECKLIST_CATEGORY_ORDER.filter((cat) => byCategory.has(cat)).map((category) => {
    const categoryItems = byCategory.get(category)!;
    return { category, status: worstChecklistStatus(categoryItems.map((i) => i.status))!, items: categoryItems };
  });
}
