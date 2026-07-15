import { formatDate } from '@/lib/utils/format';
import { STATUS_COLOR_GROUP, STATUS_COLOR_PALETTE, STATUS_LABELS } from '@/lib/utils/status-rules';
import { GanttTaskBars } from '@/components/gantt/GanttTaskBars';
import { ROW_HEIGHT, WORK_HEADER_HEIGHT, type TimelineScale } from '@/components/gantt/ganttLayout';
import type { TaskRow } from '@/components/tasks/TasksExplorer';
import type { TaskDelayInfo } from '@/lib/utils/delay-engine';

// Split into two components (rather than one returning left+timeline as
// sibling fragments) because GanttBoard renders every Work group's left
// panel stacked in one column and every group's timeline stacked in a
// second, separately-scrolling column — interleaving left/timeline pairs as
// fragment siblings inside one flex row would put them side by side per
// group instead of stacked in two columns. Both halves take the same
// `open` value, lifted to GanttBoard, so one collapse toggle affects both.

interface LeftPanelProps {
  workName: string;
  workColor: string;
  rows: TaskRow[];
  open: boolean;
  onToggle: () => void;
  onOpenDetail: (row: TaskRow) => void;
}

export function GanttWorkLeftPanel({ workName, workColor, rows, open, onToggle, onOpenDetail }: LeftPanelProps) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        style={{ height: WORK_HEADER_HEIGHT }}
        className="w-full flex items-center gap-2 px-3 bg-muted/40 hover:bg-muted/60 transition-colors text-left border-b border-border"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className={`text-muted-foreground transition-transform flex-shrink-0 ${open ? 'rotate-90' : ''}`}>
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: workColor }} />
        <span className="text-[12px] font-semibold truncate">{workName}</span>
        <span className="text-[10.5px] text-muted-foreground flex-shrink-0">{rows.length}</span>
      </button>
      {open && rows.map((r) => {
        const statusColor = STATUS_COLOR_PALETTE[STATUS_COLOR_GROUP[r.status]];
        return (
          <div
            key={r.id}
            style={{ height: ROW_HEIGHT }}
            className="flex items-center gap-2 px-3 border-b border-border/60 cursor-pointer hover:bg-muted/30"
            onClick={() => onOpenDetail(r)}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium truncate" title={r.taskName}>
                <span className="font-mono text-muted-foreground">{r.taskId}</span> · {r.taskName}
              </p>
              <p className="text-[10.5px] text-muted-foreground truncate">
                {r.plannedStartDate && r.dueDate
                  ? `${formatDate(r.plannedStartDate)} – ${formatDate(r.dueDate)}`
                  : 'Not scheduled'}
              </p>
            </div>
            <span
              className="flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full border"
              style={{ background: statusColor.bg, borderColor: statusColor.border, color: statusColor.text }}
            >
              {STATUS_LABELS[r.status]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface TimelinePanelProps {
  rows: TaskRow[];
  delayById: Record<string, TaskDelayInfo>;
  groundedIds: Set<string>;
  scale: TimelineScale;
  open: boolean;
  onOpenDetail: (row: TaskRow) => void;
}

export function GanttWorkTimelinePanel({ rows, delayById, groundedIds, scale, open, onOpenDetail }: TimelinePanelProps) {
  return (
    <div>
      <div style={{ height: WORK_HEADER_HEIGHT }} className="border-b border-border bg-muted/40" />
      {open && rows.map((r) => (
        <div key={r.id} className="border-b border-border/60">
          <GanttTaskBars
            row={r}
            delay={delayById[r.id]}
            grounded={groundedIds.has(r.id)}
            scale={scale}
            onOpenDetail={() => onOpenDetail(r)}
          />
        </div>
      ))}
    </div>
  );
}
