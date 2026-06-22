import Link from 'next/link';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  draft:       { label: 'Draft',       color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB', dot: '#9CA3AF' },
  ready:       { label: 'Ready',       color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE', dot: '#3B82F6' },
  in_progress: { label: 'In Progress', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', dot: '#F59E0B' },
  on_hold:     { label: 'On Hold',     color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', dot: '#8B5CF6' },
  blocked:     { label: 'Blocked',     color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', dot: '#EF4444' },
  completed:   { label: 'Completed',   color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0', dot: '#22C55E' },
};

interface FlowTask {
  id: string;
  taskId: string;
  taskName: string;
  status: string;
  completionPct: number;
}

interface TaskFlowMapProps {
  tasks: FlowTask[];
}

export function TaskFlowMap({ tasks }: TaskFlowMapProps) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex items-center gap-0 min-w-max">
        {tasks.map((task, idx) => {
          const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.draft;
          return (
            <div key={task.id} className="flex items-center">
              {/* Task card */}
              <Link
                href={`/hvac/${task.id}`}
                className="group flex flex-col gap-2 w-44 rounded-lg border-2 p-3 transition-all hover:shadow-md hover:-translate-y-0.5"
                style={{ borderColor: cfg.border, backgroundColor: cfg.bg }}
              >
                {/* Task ID + status dot */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10.5px] font-bold" style={{ color: cfg.color }}>
                    {task.taskId}
                  </span>
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cfg.dot }}
                  />
                </div>

                {/* Task name */}
                <p className="text-[12px] font-semibold text-foreground leading-tight line-clamp-2 min-h-[2rem]">
                  {task.taskName}
                </p>

                {/* Progress bar */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted-foreground">Dependencies</span>
                    <span className="text-[10px] font-mono font-semibold" style={{ color: cfg.color }}>
                      {task.completionPct}%
                    </span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: cfg.border }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${task.completionPct}%`, backgroundColor: cfg.dot }}
                    />
                  </div>
                </div>

                {/* Status label */}
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full self-start"
                  style={{ color: cfg.color, backgroundColor: cfg.border }}
                >
                  {cfg.label}
                </span>
              </Link>

              {/* Arrow connector (not after last item) */}
              {idx < tasks.length - 1 && (
                <div className="flex items-center px-1 flex-shrink-0">
                  <svg width="28" height="16" viewBox="0 0 28 16" fill="none">
                    <path d="M0 8 H20" stroke="#CBD5E1" strokeWidth="1.5" strokeDasharray="3 2"/>
                    <path d="M16 4 L22 8 L16 12" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                </div>
              )}
            </div>
          );
        })}

        {/* Add next task button */}
        <div className="flex items-center">
          {tasks.length > 0 && (
            <div className="flex items-center px-1 flex-shrink-0">
              <svg width="28" height="16" viewBox="0 0 28 16" fill="none">
                <path d="M0 8 H20" stroke="#CBD5E1" strokeWidth="1.5" strokeDasharray="3 2"/>
                <path d="M16 4 L22 8 L16 12" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
            </div>
          )}
          <Link
            href="/hvac/new"
            className="flex flex-col items-center justify-center gap-1 w-44 h-[118px] rounded-lg border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-all group"
          >
            <div className="w-8 h-8 rounded-full bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground group-hover:text-primary transition-colors">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </div>
            <span className="text-[11px] font-medium text-muted-foreground group-hover:text-primary transition-colors">
              Add Next Task
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
