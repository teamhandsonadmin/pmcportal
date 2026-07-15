import { addDays, differenceInCalendarDays } from 'date-fns';
import type { TaskDelayInfo } from '@/lib/utils/delay-engine';
import { STATUS_COLOR_GROUP, STATUS_COLOR_PALETTE } from '@/lib/utils/status-rules';
import type { TaskRow } from '@/components/tasks/TasksExplorer';
import { ROW_HEIGHT, type TimelineScale } from '@/components/gantt/ganttLayout';

const BAR_HEIGHT = 16;
const PLANNED_BAR_TOP = (ROW_HEIGHT - BAR_HEIGHT * 2) / 2;
const PROJECTED_BAR_TOP = PLANNED_BAR_TOP + BAR_HEIGHT; // touching, no gap — see Part 4's spec

// Distinct from any status color (including the existing "blocked" red,
// #EF4444) by shape, not just hue — a diagonal stripe reads as "overrun"
// unambiguously regardless of what solid color happens to sit next to it.
const DELAY_STRIPE_BG =
  'repeating-linear-gradient(45deg, #DC2626, #DC2626 4px, #FCA5A5 4px, #FCA5A5 8px)';

interface GanttTaskBarsProps {
  row: TaskRow;
  delay: TaskDelayInfo | undefined;
  grounded: boolean;
  scale: TimelineScale;
  onOpenDetail: (taskId: string) => void;
}

export function GanttTaskBars({ row, delay, grounded, scale, onOpenDetail }: GanttTaskBarsProps) {
  // The delay engine's own honesty safeguard: an "ungrounded" task (no
  // planned dates, no grounded prerequisite) gets a placeholder here too,
  // not a fabricated bar that could be misread as "on schedule" — see
  // lib/data/gantt-delay.ts's groundedIds computation.
  if (!grounded || !delay) {
    return (
      <div style={{ height: ROW_HEIGHT }} className="relative flex items-center px-2">
        <span className="text-[10.5px] text-muted-foreground italic">No planned dates set</span>
      </div>
    );
  }

  const statusColor = STATUS_COLOR_PALETTE[STATUS_COLOR_GROUP[row.status]].dot;

  const plannedBar = row.plannedStartDate && row.dueDate
    ? {
        left: scale.dateToX(row.plannedStartDate),
        width: scale.dateToX(row.dueDate) - scale.dateToX(row.plannedStartDate) + scale.pxPerDay,
      }
    : null;

  const hasDelay = !!row.dueDate && delay.totalDelayDays > 0;
  const normalEnd = hasDelay && row.dueDate! < delay.projectedFinish ? row.dueDate! : delay.projectedFinish;
  const normalSpanDays = differenceInCalendarDays(normalEnd, delay.projectedStart) + 1;
  const hasNormalSegment = normalSpanDays > 0;

  const normalSegment = hasNormalSegment
    ? {
        left: scale.dateToX(delay.projectedStart),
        width: scale.dateToX(normalEnd) - scale.dateToX(delay.projectedStart) + scale.pxPerDay,
      }
    : null;

  const delaySegment = hasDelay
    ? (() => {
        const start = hasNormalSegment ? addDays(normalEnd, 1) : delay.projectedStart;
        return {
          left: scale.dateToX(start),
          width: scale.dateToX(delay.projectedFinish) - scale.dateToX(start) + scale.pxPerDay,
        };
      })()
    : null;

  return (
    <div
      style={{ height: ROW_HEIGHT }}
      className="relative cursor-pointer group"
      onClick={() => onOpenDetail(row.id)}
      title={`${row.taskId} — click for schedule details`}
    >
      {plannedBar && (
        <div
          className="absolute rounded-sm group-hover:brightness-95 transition-[filter]"
          style={{ top: PLANNED_BAR_TOP, height: BAR_HEIGHT, left: plannedBar.left, width: Math.max(plannedBar.width, 2), backgroundColor: row.workColor, opacity: 0.55 }}
        />
      )}
      {normalSegment && (
        <div
          className="absolute rounded-sm group-hover:brightness-95 transition-[filter]"
          // Same light treatment as the planned bar above (opacity 0.55) —
          // this bar is a WORKFLOW status color (e.g. red for "blocked",
          // meaning "waiting on its dependency checklist"), not a schedule
          // health signal. At full saturation it reads as "behind plan" /
          // an alarm even for an on-schedule, not-yet-started task, which is
          // exactly what the real delay stripe below is for — this bar
          // should never compete with that at the same visual intensity.
          style={{ top: PROJECTED_BAR_TOP, height: BAR_HEIGHT, left: normalSegment.left, width: Math.max(normalSegment.width, 2), backgroundColor: statusColor, opacity: 0.55 }}
        />
      )}
      {delaySegment && (
        <div
          className="absolute rounded-sm group-hover:brightness-95 transition-[filter]"
          style={{ top: PROJECTED_BAR_TOP, height: BAR_HEIGHT, left: delaySegment.left, width: Math.max(delaySegment.width, 2), backgroundImage: DELAY_STRIPE_BG }}
        />
      )}
    </div>
  );
}
