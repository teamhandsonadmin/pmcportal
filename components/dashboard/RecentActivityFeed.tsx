import Link from 'next/link';
import { formatRelativeTime } from '@/lib/utils/format';
import { STATUS_LABELS } from '@/lib/utils/status-rules';
import type { ActivityEvent, TaskStatus } from '@/lib/types/hvac';

interface RecentActivityFeedProps {
  events: ActivityEvent[];
}

const actionSymbols: Record<string, string> = {
  task_created:     '+',
  status_change:    '↗',
  checklist_update: '✓',
  comment:          '·',
};

function eventSummary(event: ActivityEvent): string {
  const p = event.payload;
  switch (event.actionType) {
    case 'task_created':     return `Task ${p?.taskId ?? ''} created`;
    case 'status_change':    return `${STATUS_LABELS[(p?.from as TaskStatus) ?? 'draft']} → ${STATUS_LABELS[(p?.to as TaskStatus) ?? 'draft']}`;
    case 'checklist_update': return `Item ${p?.completed ? 'completed' : 'unchecked'}`;
    case 'comment':          return `Comment added`;
    default:                 return 'Activity';
  }
}

export function RecentActivityFeed({ events }: RecentActivityFeedProps) {
  if (!events.length) {
    return (
      <div className="py-8 text-center">
        <p className="text-[12px] text-muted-foreground">No activity yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {events.map((event) => {
        const symbol = actionSymbols[event.actionType] ?? '·';
        return (
          <Link
            key={event.id}
            href={`/hvac/${event.taskId}/activity`}
            className="flex items-start gap-3 py-2 px-2 rounded-lg hover:bg-muted/60 transition-colors group"
          >
            <div className="w-5 h-5 rounded-full border border-border bg-card flex items-center justify-center text-[10px] font-semibold text-muted-foreground flex-shrink-0 mt-0.5">
              {symbol}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] text-foreground leading-tight truncate group-hover:text-primary transition-colors">
                {eventSummary(event)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                {formatRelativeTime(event.createdAt)}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
