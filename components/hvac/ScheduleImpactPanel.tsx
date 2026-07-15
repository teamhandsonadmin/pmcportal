import Link from 'next/link';
import type { TaskScheduleImpact } from '@/lib/data/delay-engine';

interface ScheduleImpactPanelProps {
  impact: TaskScheduleImpact;
}

export function ScheduleImpactPanel({ impact }: ScheduleImpactPanelProps) {
  const { self, drivingPrerequisite, downstreamImpacted } = impact;
  const hasPlannedDates = !!(self.plannedStartDate && self.dueDate);

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Schedule Impact</h2>

      {self.status === 'completed' && (
        <p className="text-[11px] text-muted-foreground/80">
          {self.actualEndDate
            ? 'Based on this task’s actual completion date.'
            : 'Based on the due date — no actual completion date has been recorded for this task.'}
        </p>
      )}

      {!hasPlannedDates ? (
        <p className="text-[12.5px] text-muted-foreground">No planned dates set — nothing to project yet.</p>
      ) : self.totalDelayDays <= 0 ? (
        <p className="text-[13px] font-medium text-green-700 dark:text-green-400">On schedule</p>
      ) : (
        <div className="space-y-1.5">
          <p className="text-[13px] font-medium text-red-600">
            {self.totalDelayDays} working day{self.totalDelayDays === 1 ? '' : 's'} behind plan
          </p>
          {self.inheritedDelayDays > 0 && drivingPrerequisite && (
            <p className="text-[12.5px] text-muted-foreground">
              Delayed by {self.inheritedDelayDays} working day{self.inheritedDelayDays === 1 ? '' : 's'} due to{' '}
              <Link
                href={`/hvac/${drivingPrerequisite.id}/overview`}
                className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
              >
                {drivingPrerequisite.taskCode} — {drivingPrerequisite.taskName}
              </Link>
              .
            </p>
          )}
          {self.ownDelayDays > 0 && (
            <p className="text-[12.5px] text-muted-foreground">
              {self.ownDelayDays} working day{self.ownDelayDays === 1 ? '' : 's'} of that is this task&apos;s own slippage,
              beyond what it inherited.
            </p>
          )}
        </div>
      )}

      {downstreamImpacted.length > 0 && (
        <div className="pt-2 border-t border-border/60 space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground">
            This task is the main driver of delay for {downstreamImpacted.length} downstream task{downstreamImpacted.length === 1 ? '' : 's'}:
          </p>
          <ul className="space-y-1">
            {downstreamImpacted.map((d) => (
              <li key={d.id} className="text-[12px] flex items-center justify-between gap-2">
                <Link
                  href={`/hvac/${d.id}/overview`}
                  className="text-foreground hover:underline underline-offset-2 truncate"
                >
                  {d.taskCode} — {d.taskName}
                </Link>
                <span className="text-muted-foreground flex-shrink-0">{d.totalDelayDays}d</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
