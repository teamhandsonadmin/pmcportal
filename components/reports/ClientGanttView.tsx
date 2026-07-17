'use client';

import { useMemo, useState } from 'react';
import { GanttTimelineHeader } from '@/components/gantt/GanttTimelineHeader';
import {
  ROW_HEIGHT,
  WORK_HEADER_HEIGHT,
  TIMELINE_HEADER_HEIGHT,
  ZOOM_PX_PER_DAY,
  computeTimelineRange,
  buildTimelineScale,
  type ZoomLevel,
} from '@/components/gantt/ganttLayout';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { formatDate } from '@/lib/utils/format';
import { PROGRESS_BUCKET_COLORS, type ProgressBucket } from '@/lib/utils/progress-bucket';
import type { ReportGanttTask, ReportGanttWork } from '@/lib/data/report';

const ZOOM_LEVELS: ZoomLevel[] = ['Week', 'Month'];
const BAR_HEIGHT = 16;

// Same diagonal-stripe language as the internal admin Gantt's own delay
// indicator (components/gantt/GanttTaskBars.tsx) — distinct from any bucket
// color by SHAPE, not just hue, so "overdue" reads unambiguously even next
// to whichever bucket color the bar would otherwise have been.
const DELAY_STRIPE_BG = 'repeating-linear-gradient(45deg, #DC2626, #DC2626 4px, #FCA5A5 4px, #FCA5A5 8px)';

const BUCKET_LABELS: Record<ProgressBucket, string> = {
  completed: 'Completed',
  inProgress: 'In Progress',
  notStarted: 'Not Started Yet',
};

const LEGEND: { bucket: ProgressBucket; label: string }[] = [
  { bucket: 'completed', label: 'Completed' },
  { bucket: 'inProgress', label: 'In Progress' },
  { bucket: 'notStarted', label: 'Not Started Yet' },
];

// Hover-only, lightweight by design (a "tooltip," not the admin Gantt's own
// click-to-open GanttDetailPopup, which needs its own server round-trip for
// working-day/CPM delay figures) — task name, planned window, and current
// status, plus how many days overdue when that's the reason the bar is
// striped, which is the one piece of "why does this look different"
// information a client reading this report actually needs.
function TaskBarTooltipContent({ task }: { task: ReportGanttTask }) {
  return (
    <TooltipContent side="top" className="p-2.5">
      <p className="text-[12px] font-semibold text-white">{task.taskName}</p>
      <p className="text-[11px] text-gray-300 mt-0.5">
        {formatDate(task.plannedStartDate)} → {formatDate(task.dueDate)}
      </p>
      {task.isOverdue ? (
        <p className="text-[11px] font-semibold text-red-400 mt-1">
          {task.overdueDays} day{task.overdueDays === 1 ? '' : 's'} overdue
        </p>
      ) : (
        <p className="text-[11px] text-gray-300 mt-1">{BUCKET_LABELS[task.bucket]}</p>
      )}
    </TooltipContent>
  );
}

// A deliberately separate, stripped-down renderer — NOT GanttBoard/
// GanttTaskBars reused with flags hidden, since those unconditionally
// render the checklist-health dot/tooltip and open an admin edit popup on
// click. This client-facing view only needs "which trade, which weeks" —
// real bars spanning each task's actual plannedStartDate/dueDate, colored
// by the SAME 3-bucket progress classification as this report's own pie
// chart (see lib/data/report.ts's classifyTaskStatus) rather than the
// admin Gantt's internal 4-color status palette — reusing that one here
// would paint "blocked" red (an alarm) and directly contradict the pie
// chart just above, which already treats "blocked" as neutral/not-started.
export function ClientGanttView({ works }: { works: ReportGanttWork[] }) {
  const [zoom, setZoom] = useState<ZoomLevel>('Week');
  const today = useMemo(() => new Date(), []);

  const scale = useMemo(() => {
    const dates: Date[] = [];
    for (const w of works) {
      for (const t of w.tasks) {
        if (t.plannedStartDate) dates.push(t.plannedStartDate);
        if (t.dueDate) dates.push(t.dueDate);
      }
    }
    const { rangeStart, rangeEnd } = computeTimelineRange(dates, today);
    return buildTimelineScale(rangeStart, rangeEnd, ZOOM_PX_PER_DAY[zoom]);
  }, [works, today, zoom]);

  const hasAnyTask = works.some((w) => w.tasks.length > 0);
  if (!hasAnyTask) {
    return <p className="text-[12.5px] text-gray-400 italic py-8 text-center">No scheduled tasks yet.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          {LEGEND.map((l) => (
            <span key={l.bucket} className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
              <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: PROGRESS_BUCKET_COLORS[l.bucket] }} />
              {l.label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundImage: DELAY_STRIPE_BG }} />
            Delayed
          </span>
        </div>
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
          {ZOOM_LEVELS.map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZoom(z)}
              className={`px-2.5 py-1 text-[11.5px] font-semibold rounded-md transition-colors ${
                zoom === z ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {z}
            </button>
          ))}
        </div>
      </div>
      <div className="flex border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex-shrink-0 border-r border-gray-200" style={{ width: 200 }}>
          <div style={{ height: TIMELINE_HEADER_HEIGHT }} className="border-b border-gray-200 bg-white" />
          {works.map((w) => (
            <div key={w.workId}>
              <div
                className="flex items-center gap-2 px-3 bg-gray-50 border-b border-gray-100"
                style={{ height: WORK_HEADER_HEIGHT }}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: w.workColor }} />
                <span className="text-[12px] font-semibold text-gray-700 truncate">{w.workName}</span>
              </div>
              {w.tasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center px-3 border-b border-gray-50"
                  style={{ height: ROW_HEIGHT }}
                >
                  <span className="text-[12px] text-gray-700 truncate" title={t.taskName}>{t.taskName}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-x-auto">
          <div style={{ width: scale.totalWidth }}>
            <GanttTimelineHeader scale={scale} today={today} />
            {works.map((w) => (
              <div key={w.workId}>
                <div style={{ height: WORK_HEADER_HEIGHT }} className="border-b border-gray-200 bg-gray-50" />
                {w.tasks.map((t) => {
                  const bar = t.plannedStartDate
                    ? {
                        left: scale.dateToX(t.plannedStartDate),
                        width: Math.max(
                          scale.dateToX(t.dueDate ?? t.plannedStartDate) - scale.dateToX(t.plannedStartDate) + scale.pxPerDay,
                          2
                        ),
                      }
                    : null;
                  return (
                    <div key={t.id} className="relative border-b border-gray-50" style={{ height: ROW_HEIGHT }}>
                      {bar ? (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <div
                                className="absolute rounded-sm cursor-default"
                                style={{
                                  top: (ROW_HEIGHT - BAR_HEIGHT) / 2,
                                  height: BAR_HEIGHT,
                                  left: bar.left,
                                  width: bar.width,
                                  ...(t.isOverdue
                                    ? { backgroundImage: DELAY_STRIPE_BG }
                                    : { backgroundColor: PROGRESS_BUCKET_COLORS[t.bucket] }),
                                }}
                              />
                            }
                          />
                          <TaskBarTooltipContent task={t} />
                        </Tooltip>
                      ) : (
                        <span className="absolute inset-0 flex items-center px-2 text-[10.5px] text-gray-300 italic">
                          Not yet scheduled
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
