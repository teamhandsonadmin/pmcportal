import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { TaskStatusBadge } from '@/components/hvac/TaskStatusBadge';
import { formatDate } from '@/lib/utils/format';

interface TaskLayoutProps {
  children: React.ReactNode;
  params: Promise<{ taskId: string }>;
}

export default async function TaskLayout({ children, params }: TaskLayoutProps) {
  const { taskId } = await params;

  const task = await prisma.hvacTask.findUnique({
    where: { id: taskId },
    select: { taskId: true, taskName: true, projectName: true, status: true, dueDate: true },
  }).catch(() => null);

  if (!task) notFound();

  return (
    <div>
      {/* Task header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link
              href="/hvac"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              All Tasks
            </Link>
            <div className="flex items-center gap-3 mb-1">
              <span className="font-mono text-sm font-bold text-primary">{task.taskId}</span>
              <TaskStatusBadge status={task.status} />
            </div>
            <h1 className="text-xl font-bold tracking-tight">{task.taskName}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{task.projectName}</p>
          </div>
          {task.dueDate && (
            <div className="text-right flex-shrink-0 bg-card border border-border rounded-lg px-4 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Due Date</p>
              <p className="text-sm font-mono font-semibold mt-0.5">{formatDate(task.dueDate)}</p>
            </div>
          )}
        </div>
      </div>

      {children}
    </div>
  );
}
