import { formatRelativeTime } from '@/lib/utils/format';
import { STATUS_LABELS } from '@/lib/utils/status-rules';
import type { ActivityEvent, TaskStatus } from '@/lib/types/hvac';

interface ActivityTimelineProps {
  events: ActivityEvent[];
}

function EventIcon({ type }: { type: ActivityEvent['actionType'] }) {
  const icons = {
    task_created:    '◎',
    status_change:   '⇄',
    checklist_update: '✓',
    comment:         '◷',
  };
  return <span className="text-sm">{icons[type]}</span>;
}

function EventDescription({ event }: { event: ActivityEvent }) {
  const p = event.payload;

  switch (event.actionType) {
    case 'task_created':
      return <span>Task created <span className="font-mono text-primary">{p?.taskId as string}</span></span>;

    case 'status_change':
      return (
        <span>
          Status changed from{' '}
          <span className="font-mono">{STATUS_LABELS[(p?.from as TaskStatus) ?? 'draft']}</span>
          {' → '}
          <span className="font-mono font-semibold">{STATUS_LABELS[(p?.to as TaskStatus) ?? 'draft']}</span>
        </span>
      );

    case 'checklist_update':
      return (
        <span>
          Checklist item{' '}
          <span className="font-semibold">{p?.completed ? 'checked' : 'unchecked'}</span>
        </span>
      );

    case 'comment':
      return (
        <span>
          Comment: <span className="italic text-muted-foreground">&ldquo;{p?.text as string}&rdquo;</span>
        </span>
      );

    default:
      return <span>Activity recorded</span>;
  }
}

export function ActivityTimeline({ events }: ActivityTimelineProps) {
  if (!events.length) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground text-sm">No activity yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {events.map((event, idx) => (
        <div key={event.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full border border-border bg-muted flex items-center justify-center flex-shrink-0">
              <EventIcon type={event.actionType} />
            </div>
            {idx < events.length - 1 && (
              <div className="w-px flex-1 bg-border mt-1" />
            )}
          </div>
          <div className="pb-6 pt-1.5 flex-1">
            <p className="text-sm text-foreground">
              <EventDescription event={event} />
            </p>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              {formatRelativeTime(event.createdAt)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
