'use client';

import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { ClientGanttView } from '@/components/reports/ClientGanttView';
import { PROGRESS_BUCKET_COLORS as PROGRESS_COLORS } from '@/lib/utils/progress-bucket';
import { formatDate } from '@/lib/utils/format';
import type { ProjectReportData } from '@/lib/data/report';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="w-1 h-4 rounded-full bg-gray-900" />
      <h2 className="text-[12px] font-bold uppercase tracking-[0.12em] text-gray-900">{children}</h2>
    </div>
  );
}

function ProgressPie({ progress }: { progress: ProjectReportData['progress'] }) {
  if (progress.total === 0) {
    return <p className="text-[12.5px] text-gray-400 italic py-8 text-center">No tasks yet.</p>;
  }

  const data = [
    { name: 'Completed', value: progress.completed, pct: progress.completedPct, color: PROGRESS_COLORS.completed },
    { name: 'In Progress', value: progress.inProgress, pct: progress.inProgressPct, color: PROGRESS_COLORS.inProgress },
    { name: 'Not Started Yet', value: progress.notStarted, pct: progress.notStartedPct, color: PROGRESS_COLORS.notStarted },
  ].filter((d) => d.value > 0);

  return (
    <div className="flex items-center gap-6 flex-wrap">
      <div style={{ width: 220, height: 220 }} className="flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={100}
              paddingAngle={2}
              label={(props: { payload?: { pct: number } }) => `${props.payload?.pct ?? 0}%`}
              labelLine={false}
              stroke="none"
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-3">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-[13px] text-gray-700">
              <span className="font-bold text-gray-900">{d.pct}%</span> {d.name}
              <span className="text-gray-400"> · {d.value} of {progress.total} tasks</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// A different shape than ProgressPie on purpose — this is the "read it in
// 3 seconds" summary a client scans first, task COUNTS (not a percentage
// split), with Delayed pulled out as its own hard number instead of buried
// inside "In Progress"/"Not Started," since a stalled-past-due task reads
// very differently from one that's simply not due yet.
function TaskSummaryScoreCard({ progress, overdueCount }: { progress: ProjectReportData['progress']; overdueCount: number }) {
  const cards = [
    { label: 'Planned Tasks', value: progress.total, color: '#111827' },
    { label: 'Completed', value: progress.completed, color: PROGRESS_COLORS.completed },
    { label: 'Delayed', value: overdueCount, color: overdueCount > 0 ? '#EF4444' : '#9CA3AF' },
    { label: 'Complete', value: `${progress.completedPct}%`, color: '#111827' },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3.5">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{c.label}</p>
          <p className="text-[24px] font-extrabold mt-0.5" style={{ color: c.color }}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

const UPCOMING_PAGE_SIZE = 5;

function UpcomingTasksList({ upcoming }: { upcoming: ProjectReportData['upcoming'] }) {
  const [expanded, setExpanded] = useState(false);
  if (upcoming.length === 0) {
    return <p className="text-[12.5px] text-gray-400 italic py-4 text-center">Nothing scheduled to start in the next 30 days.</p>;
  }
  const visible = expanded ? upcoming : upcoming.slice(0, UPCOMING_PAGE_SIZE);
  const remaining = upcoming.length - visible.length;
  return (
    <div>
      <div className="divide-y divide-gray-100">
        {visible.map((t) => (
          <div key={t.id} className="flex items-center justify-between py-3">
            <div>
              <p className="text-[13px] font-semibold text-gray-900">{t.taskName}</p>
              <p className="text-[11.5px] text-gray-400 mt-0.5">{t.workName}</p>
            </div>
            <span className="text-[12px] font-medium text-gray-500 flex-shrink-0">{t.dateLabel}</span>
          </div>
        ))}
      </div>
      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 text-[12.5px] font-semibold text-gray-500 hover:text-gray-900 transition-colors"
        >
          Show {remaining} more…
        </button>
      )}
      {expanded && upcoming.length > UPCOMING_PAGE_SIZE && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-2 text-[12.5px] font-semibold text-gray-500 hover:text-gray-900 transition-colors"
        >
          Show less
        </button>
      )}
    </div>
  );
}

function WorkBreakdownList({ workBreakdown }: { workBreakdown: ProjectReportData['workBreakdown'] }) {
  if (workBreakdown.length === 0) {
    return <p className="text-[12.5px] text-gray-400 italic py-4 text-center">No tasks yet.</p>;
  }
  return (
    <div className="space-y-4">
      {workBreakdown.map((w) => (
        <div key={w.workId}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: w.workColor }} />
              <span className="text-[13px] font-semibold text-gray-900">{w.workName}</span>
            </div>
            <span className="text-[12px] text-gray-400">
              {w.completed} complete · {w.inProgress} ongoing · {w.notStarted} not started
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden flex bg-gray-100">
            {w.completedPct > 0 && <div style={{ width: `${w.completedPct}%`, backgroundColor: PROGRESS_COLORS.completed }} />}
            {w.inProgressPct > 0 && <div style={{ width: `${w.inProgressPct}%`, backgroundColor: PROGRESS_COLORS.inProgress }} />}
            {w.notStartedPct > 0 && <div style={{ width: `${w.notStartedPct}%`, backgroundColor: PROGRESS_COLORS.notStarted }} />}
          </div>
        </div>
      ))}
    </div>
  );
}

const SCHEDULE_COLORS = { onSchedule: '#22C55E', delayed: '#EF4444' };

function ScheduleSummary({ schedule }: { schedule: NonNullable<ProjectReportData['schedule']> }) {
  const onScheduleDays = Math.min(schedule.plannedDays, schedule.actualDays);
  const isDelayed = schedule.delayedDays > 0;
  const data = [
    { name: 'On Schedule', value: onScheduleDays, color: SCHEDULE_COLORS.onSchedule },
    { name: 'Delayed', value: schedule.delayedDays, color: SCHEDULE_COLORS.delayed },
  ].filter((d) => d.value > 0);

  return (
    <div>
      {/* The one-sentence headline this whole section exists to answer —
          the day-count and the two dates below are the supporting detail,
          not the first thing a reader should have to piece together
          themselves. */}
      <div
        className="rounded-xl px-4 py-3 mb-5"
        style={{ backgroundColor: isDelayed ? '#FEF2F2' : '#F0FDF4' }}
      >
        <p className="text-[14px] font-bold" style={{ color: isDelayed ? SCHEDULE_COLORS.delayed : '#15803D' }}>
          {isDelayed
            ? `Project is delayed by ${schedule.delayedDays} day${schedule.delayedDays === 1 ? '' : 's'}`
            : 'Project is on schedule'}
        </p>
      </div>

      <div className="flex items-center gap-8 flex-wrap">
        <div style={{ width: 180, height: 180 }} className="flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={85}
                paddingAngle={2}
                labelLine={false}
                stroke="none"
              >
                {data.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-8 flex-wrap">
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Planned Days</p>
            <p className="text-[22px] font-extrabold text-gray-900 mt-0.5">{schedule.plannedDays}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Actual Days</p>
            <p className="text-[22px] font-extrabold text-gray-900 mt-0.5">{schedule.actualDays}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: isDelayed ? SCHEDULE_COLORS.delayed : '#9CA3AF' }}>
              Delayed Days
            </p>
            <p className="text-[22px] font-extrabold mt-0.5" style={{ color: isDelayed ? SCHEDULE_COLORS.delayed : '#111827' }}>
              {schedule.delayedDays}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-8 flex-wrap mt-5 pt-5 border-t border-gray-100">
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Planned Completion</p>
          <p className="text-[15px] font-bold text-gray-900 mt-0.5">{formatDate(schedule.plannedEndDate)}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: isDelayed ? SCHEDULE_COLORS.delayed : '#9CA3AF' }}>
            Projected Completion
          </p>
          <p className="text-[15px] font-bold mt-0.5" style={{ color: isDelayed ? SCHEDULE_COLORS.delayed : '#111827' }}>
            {formatDate(schedule.projectedEndDate)}
          </p>
        </div>
      </div>
    </div>
  );
}

export function ClientProgressReport({ data }: { data: ProjectReportData }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">{data.projectName}</h1>
        <p className="text-[13.5px] text-gray-500 mt-1">
          {data.scopedWorkName ? `${data.scopedWorkName} — ` : ''}Progress report — {data.rangeLabel ? data.rangeLabel : `as of ${data.asOfLabel}`}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <SectionTitle>Task Summary</SectionTitle>
        <TaskSummaryScoreCard progress={data.progress} overdueCount={data.overdueCount} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <SectionTitle>Overall Progress</SectionTitle>
        <ProgressPie progress={data.progress} />
      </div>

      {/* Redundant once the report is already scoped to a single Work — it'd
          just repeat the Overall Progress pie above with an extra step. */}
      {data.workBreakdown.length > 1 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <SectionTitle>Progress By Work</SectionTitle>
          <WorkBreakdownList workBreakdown={data.workBreakdown} />
        </div>
      )}

      {data.schedule && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <SectionTitle>Schedule Summary</SectionTitle>
          <ScheduleSummary schedule={data.schedule} />
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 p-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <SectionTitle>What&apos;s Coming Up (Next 30 Days)</SectionTitle>
        <UpcomingTasksList upcoming={data.upcoming} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <SectionTitle>Timeline</SectionTitle>
        <ClientGanttView works={data.ganttWorks} />
      </div>
    </div>
  );
}
