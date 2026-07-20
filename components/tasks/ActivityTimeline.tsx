import { formatRelativeTime } from '@/lib/utils/format';
import { STATUS_LABELS } from '@/lib/utils/status-rules';
import type { ActivityEvent, TaskStatus } from '@/lib/types/tasks';

interface ActivityTimelineProps {
  events: ActivityEvent[];
}

function EventIcon({ type }: { type: ActivityEvent['actionType'] }) {
  const icons = {
    task_created:              '◎',
    status_change:             '⇄',
    checklist_update:          '✓',
    comment:                   '◷',
    sft_progress_logged:       '▦',
    sft_progress_deleted:      '⊘',
    sft_target_updated:        '◫',
    inventory_item_created:    '▤',
    inventory_transaction_recorded: '⇅',
    inventory_ocr_intake:      '⌗',
    planned_dates_updated:     '📅',
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

    case 'sft_progress_logged':
      return (
        <span>
          Logged <span className="font-semibold">{String(p?.sftCompleted ?? '')} SFT</span>
          {p?.headcount != null && <> · {String(p.headcount)} workers</>}
        </span>
      );

    case 'sft_progress_deleted':
      return <span>Removed an SFT progress entry</span>;

    case 'sft_target_updated':
      return (
        <span>
          Total SFT target set to <span className="font-semibold">{String(p?.totalSft ?? '')}</span>
        </span>
      );

    case 'inventory_item_created':
      return (
        <span>
          Inventory item created: <span className="font-semibold">{p?.name as string}</span>
        </span>
      );

    case 'inventory_transaction_recorded':
      return (
        <span>
          Inventory transaction: <span className="font-mono">{p?.type as string}</span>{' '}
          {String(p?.quantity ?? '')}
        </span>
      );

    case 'inventory_ocr_intake':
      return (
        <span>
          OCR invoice intake: {String(p?.itemCount ?? 0)} item(s) recorded
        </span>
      );

    case 'planned_dates_updated': {
      const fields = (p?.fields as string[] | undefined) ?? [];
      return <span>Planned dates updated: <span className="font-mono">{fields.join(', ') || '—'}</span></span>;
    }

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
