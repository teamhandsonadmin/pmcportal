import Link from 'next/link';
import { TaskStatusBadge } from './TaskStatusBadge';
import type { HvacTask, CategoryProgress } from '@/lib/types/hvac';
import { formatDate, isOverdue, calcOverallProgress } from '@/lib/utils/format';

export function TaskCard({ task, progress }: { task: HvacTask; progress: CategoryProgress[] }) {
  const overallPct = calcOverallProgress(progress);
  const overdue = isOverdue(task.dueDate) && task.status !== 'completed';

  return (
    <Link
      href={`/hvac/${task.id}`}
      className="group flex items-center gap-4 px-4 py-4 bg-card border-b border-border hover:bg-gray-50 transition-colors last:border-b-0"
    >
      {/* Task ID */}
      <div className="w-20 flex-shrink-0">
        <span className="text-[11px] font-semibold text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded-md">
          {task.taskId}
        </span>
      </div>

      {/* Name + project */}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-foreground truncate group-hover:text-gray-900 transition-colors">
          {task.taskName}
        </div>
        <div className="text-[11.5px] text-muted-foreground mt-0.5 truncate">{task.projectName}</div>
      </div>

      {/* Status */}
      <div className="w-28 flex-shrink-0">
        <TaskStatusBadge status={task.status} />
      </div>

      {/* Progress */}
      <div className="w-32 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300 bg-gray-800"
              style={{ width: `${overallPct}%` }}
            />
          </div>
          <span className="text-[11px] font-mono text-muted-foreground w-8 text-right tabular-nums">
            {overallPct}%
          </span>
        </div>
      </div>

      {/* Due date */}
      <div className="w-24 flex-shrink-0 text-right">
        {task.dueDate ? (
          <span className={`text-[11.5px] font-mono ${overdue ? 'text-gray-800 font-semibold' : 'text-muted-foreground'}`}>
            {formatDate(task.dueDate)}
          </span>
        ) : (
          <span className="text-[11.5px] text-muted-foreground/30">—</span>
        )}
      </div>
    </Link>
  );
}

export function TaskListHeader() {
  return (
    <div className="flex items-center gap-4 px-4 py-2.5 bg-muted/50 border-b border-border">
      <div className="w-20 flex-shrink-0 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-widest">ID</div>
      <div className="flex-1 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-widest">Task / Project</div>
      <div className="w-28 flex-shrink-0 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-widest">Status</div>
      <div className="w-32 flex-shrink-0 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-widest">Dependencies</div>
      <div className="w-24 flex-shrink-0 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-widest text-right">Due Date</div>
    </div>
  );
}
