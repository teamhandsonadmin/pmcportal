import type { TaskStatus } from '@/lib/types/hvac';

// Pulled out of lib/data/report.ts (a server-only module that imports
// prisma/pg) into its own dependency-free file specifically so client
// components (ClientProgressReport.tsx, ClientGanttView.tsx) can import
// this constant/function as a real VALUE import without dragging prisma's
// module graph — and `pg`'s Node-only `dns`/`net` internals — into the
// browser bundle. A type-only import erases at compile time and wouldn't
// have this problem; a value import does not.
//
// Client-facing 3-bucket grouping — collapses the 6 internal TaskStatus
// values to what a non-technical reader actually needs: has this physically
// started yet. draft/ready/blocked all mean "hasn't begun on site" from a
// client's point of view — the difference between "blocked on a checklist
// item" and "not yet scheduled" is internal workflow detail. on_hold still
// counts as in-progress since work already started before pausing.
// Deliberately a different grouping from status-rules.ts's internal
// STATUS_COLOR_GROUP (which colors "blocked" red) — reusing that one here,
// including on the Gantt bars, would read as an alarm for what is routine,
// not-yet-started work, and would contradict this same report's own pie
// chart, which already treats "blocked" as neutral. One shared
// classification, used by both the pie and the Gantt, so they can never
// show contradictory colors for the same task.
export type ProgressBucket = 'completed' | 'inProgress' | 'notStarted';

export const PROGRESS_BUCKET_COLORS: Record<ProgressBucket, string> = {
  completed: '#22C55E',
  inProgress: '#F59E0B',
  notStarted: '#9CA3AF',
};

export function classifyTaskStatus(status: TaskStatus): ProgressBucket {
  if (status === 'completed') return 'completed';
  if (status === 'in_progress' || status === 'on_hold') return 'inProgress';
  return 'notStarted';
}
