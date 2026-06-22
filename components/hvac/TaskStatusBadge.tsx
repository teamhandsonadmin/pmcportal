import type { TaskStatus } from '@/lib/types/hvac';
import { STATUS_LABELS } from '@/lib/utils/status-rules';

const statusConfig: Record<TaskStatus, { dot: string; bg: string; text: string }> = {
  draft:       { dot: '#9ca3af', bg: '#f3f4f6', text: '#6b7280' },
  ready:       { dot: '#374151', bg: '#e5e7eb', text: '#374151' },
  in_progress: { dot: '#ffffff', bg: '#111111', text: '#ffffff' },
  on_hold:     { dot: '#6b7280', bg: '#f3f4f6', text: '#374151' },
  blocked:     { dot: '#ffffff', bg: '#1f2937', text: '#ffffff' },
  completed:   { dot: '#ffffff', bg: '#374151', text: '#ffffff' },
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const { dot, bg, text } = statusConfig[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded-md text-[11px] font-medium leading-none"
      style={{ backgroundColor: bg, color: text }}
    >
      <span className="w-[5px] h-[5px] rounded-full flex-shrink-0" style={{ backgroundColor: dot }} />
      {STATUS_LABELS[status]}
    </span>
  );
}
