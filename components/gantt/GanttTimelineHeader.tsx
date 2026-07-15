import { format } from 'date-fns';
import { MONTH_HEADER_HEIGHT, TIMELINE_HEADER_HEIGHT, WEEK_HEADER_HEIGHT, type TimelineScale } from '@/components/gantt/ganttLayout';

interface GanttTimelineHeaderProps {
  scale: TimelineScale;
  today: Date;
}

// Sticky at the top of the horizontally-scrolling timeline panel — see
// GanttBoard's layout comment for why this needs no scroll-sync JS: it's a
// plain sibling of the row content inside the same overflow-x container, so
// scrolling that container moves the header and the bars together for free.
export function GanttTimelineHeader({ scale, today }: GanttTimelineHeaderProps) {
  const todayX = scale.dateToX(today);
  const todayInRange = today >= scale.rangeStart && today <= scale.rangeEnd;

  return (
    <div
      className="sticky top-0 z-20 bg-card border-b border-border"
      style={{ height: TIMELINE_HEADER_HEIGHT, width: scale.totalWidth }}
    >
      <div className="relative" style={{ height: MONTH_HEADER_HEIGHT }}>
        {scale.months.map((m) => (
          <div
            key={`${m.label}-${m.left}`}
            className="absolute top-0 flex items-center border-r border-border/60 px-2"
            style={{ left: m.left, width: m.width, height: MONTH_HEADER_HEIGHT }}
          >
            <span className="text-[11px] font-semibold text-foreground truncate">{m.label}</span>
          </div>
        ))}
      </div>
      <div className="relative border-t border-border/60" style={{ height: WEEK_HEADER_HEIGHT }}>
        {scale.weeks.map((w) => (
          <div
            key={w.start.toISOString()}
            className="absolute top-0 flex items-center justify-center border-r border-border/60"
            style={{ left: w.left, width: w.width, height: WEEK_HEADER_HEIGHT }}
          >
            <span className="text-[9.5px] text-muted-foreground whitespace-nowrap">
              {format(w.start, 'dd/MM')}–{format(w.end, 'dd/MM')}
            </span>
          </div>
        ))}
      </div>
      {todayInRange && (
        <div
          className="absolute top-0 bottom-0 w-px bg-red-400/70 pointer-events-none"
          style={{ left: todayX }}
          title="Today"
        />
      )}
    </div>
  );
}
