import { addDays, differenceInCalendarDays, eachWeekOfInterval, endOfWeek, format, max, min, startOfWeek } from 'date-fns';

// Fixed row geometry, shared between the left task-list panel and the
// timeline panel so their rows line up purely by normal DOM flow (both are
// plain siblings in the same vertical scroll, no JS scroll-sync) — same
// approach already used by the flowchart canvas and the original
// frappe-gantt-based board.
export const ROW_HEIGHT = 52; // tall enough for two stacked bars + a small gap
export const WORK_HEADER_HEIGHT = 40;
export const MONTH_HEADER_HEIGHT = 24;
export const WEEK_HEADER_HEIGHT = 32;
export const TIMELINE_HEADER_HEIGHT = MONTH_HEADER_HEIGHT + WEEK_HEADER_HEIGHT;

export type ZoomLevel = 'Day' | 'Week' | 'Month';
export const ZOOM_PX_PER_DAY: Record<ZoomLevel, number> = {
  Day: 32,
  Week: 12,
  Month: 4,
};

export interface WeekColumn {
  start: Date;
  end: Date;
  left: number; // px offset from the timeline's own start
  width: number; // px
}

export interface MonthColumn {
  label: string;
  left: number;
  width: number;
}

export interface TimelineScale {
  rangeStart: Date;
  rangeEnd: Date;
  pxPerDay: number;
  totalWidth: number;
  weeks: WeekColumn[];
  months: MonthColumn[];
  dateToX: (date: Date) => number;
}

// Expands the raw min/max across every date actually worth showing to full
// Monday-Sunday weeks, plus a week of padding on each side so the first/last
// bars aren't flush against the timeline's edge. Falls back to a fixed
// today-centered window when there's nothing to show at all (e.g. every
// visible task is ungrounded) so the header never renders as a zero-width sliver.
export function computeTimelineRange(dates: Date[], today: Date): { rangeStart: Date; rangeEnd: Date } {
  if (dates.length === 0) {
    return {
      rangeStart: startOfWeek(addDays(today, -28), { weekStartsOn: 1 }),
      rangeEnd: endOfWeek(addDays(today, 28), { weekStartsOn: 1 }),
    };
  }
  const rawStart = min(dates);
  const rawEnd = max(dates);
  return {
    rangeStart: startOfWeek(addDays(rawStart, -7), { weekStartsOn: 1 }),
    rangeEnd: endOfWeek(addDays(rawEnd, 7), { weekStartsOn: 1 }),
  };
}

export function buildTimelineScale(rangeStart: Date, rangeEnd: Date, pxPerDay: number): TimelineScale {
  const dateToX = (date: Date) => differenceInCalendarDays(date, rangeStart) * pxPerDay;
  const totalWidth = dateToX(rangeEnd) + pxPerDay; // +1 day so the last day's column is fully included

  const weekStarts = eachWeekOfInterval({ start: rangeStart, end: rangeEnd }, { weekStartsOn: 1 });
  const weeks: WeekColumn[] = weekStarts.map((start) => {
    const end = endOfWeek(start, { weekStartsOn: 1 });
    return { start, end, left: dateToX(start), width: 7 * pxPerDay };
  });

  const months: MonthColumn[] = [];
  for (const week of weeks) {
    const label = format(week.start, 'MMM yyyy');
    const last = months[months.length - 1];
    if (last && last.label === label) {
      last.width += week.width;
    } else {
      months.push({ label, left: week.left, width: week.width });
    }
  }

  return { rangeStart, rangeEnd, pxPerDay, totalWidth, weeks, months, dateToX };
}
