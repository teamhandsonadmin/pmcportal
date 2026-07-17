import { addDays, differenceInCalendarDays } from 'date-fns';
import type { TaskDelayInfo } from '@/lib/utils/delay-engine';
import { STATUS_COLOR_GROUP, STATUS_COLOR_PALETTE } from '@/lib/utils/status-rules';
import { STATUS_CHIP } from '@/components/hvac/StatusDropdown';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { checklistHealthByCategory } from '@/lib/utils/checklist-health';
import type { TaskRow } from '@/components/tasks/TasksExplorer';
import type { DependencyCategory } from '@/lib/types/hvac';
import { ROW_HEIGHT, type TimelineScale } from '@/components/gantt/ganttLayout';

const HEALTH_BOX_SIZE = 9;
const HEALTH_BOX_GAP = 3;

const CATEGORY_LABELS: Record<DependencyCategory, string> = {
  architect: 'Architect',
  client: 'Client',
  consultant: 'Consultant',
  contractor: 'Contractor',
  inspector: 'Inspector',
  procurement: 'Procurement',
};

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

// One category's own items only — the content shown by a single box's
// tooltip (see ChecklistHealthBoxes), not the full multi-category dump the
// old single combined dot used to open.
function CategoryItemsTooltipContent({ categoryLabel, items }: { categoryLabel: string; items: TaskRow['checklistItems'] }) {
  return (
    <div className="w-60 max-h-72 overflow-y-auto py-1">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5 px-1">{categoryLabel}</p>
      <div className="space-y-1">
        {items.map((item, i) => {
          const chip = STATUS_CHIP[item.status];
          return (
            <div key={i} className="flex items-center justify-between gap-2 px-1">
              <span className="text-[11px] text-gray-100 truncate">{item.itemLabel}</span>
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0"
                style={{ backgroundColor: chip.bg, color: chip.text }}
              >
                <span className="w-[5px] h-[5px] rounded-full flex-shrink-0" style={{ backgroundColor: chip.dot }} />
                {chip.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// One small box PER CATEGORY that actually has items on this task (max 6,
// fixed order — see checklistHealthByCategory), each colored by that
// category's own worst status. Ports the mobile app's CategoryHealthBoxes
// design exactly (site-engineer-app/components/gantt/CategoryHealthBoxes.tsx)
// — that replaced this same admin-web dot with per-category boxes there
// first; this brings admin-web's own Gantt in line with it, so a task's
// checklist health reads identically on both. Hovering a box (this is a
// desktop-only surface — mobile's equivalent is a tap) shows ONLY that
// category's items, not every category at once.
function ChecklistHealthBoxes({ row }: { row: TaskRow }) {
  const categories = checklistHealthByCategory(row.checklistItems);
  if (categories.length === 0) return null;
  return (
    <div className="absolute z-10 flex" style={{ top: 4, left: 4, gap: HEALTH_BOX_GAP }}>
      {categories.map((cat) => (
        <Tooltip key={cat.category}>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="rounded-[2px] border border-white shadow-sm cursor-default"
                style={{ width: HEALTH_BOX_SIZE, height: HEALTH_BOX_SIZE, backgroundColor: STATUS_CHIP[cat.status].dot }}
              />
            }
          />
          <TooltipContent side="right" className="p-2 bg-gray-900">
            <CategoryItemsTooltipContent categoryLabel={CATEGORY_LABELS[cat.category]} items={cat.items} />
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

export function GanttTaskBars({ row, delay, grounded, scale, onOpenDetail }: GanttTaskBarsProps) {
  // The delay engine's own honesty safeguard: an "ungrounded" task (no
  // planned dates, no grounded prerequisite) gets a placeholder here too,
  // not a fabricated bar that could be misread as "on schedule" — see
  // lib/data/gantt-delay.ts's groundedIds computation.
  if (!grounded || !delay) {
    return (
      <div style={{ height: ROW_HEIGHT }} className="relative flex items-center px-2">
        <ChecklistHealthBoxes row={row} />
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
      <ChecklistHealthBoxes row={row} />
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
