import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { TaskStatusControl } from '@/components/hvac/TaskStatusControl';
import { DependencyProgress, OverallProgress } from '@/components/hvac/DependencyProgress';
import { isLocked } from '@/lib/utils/status-rules';
import { formatDate, formatDateTime } from '@/lib/utils/format';
import type { CategoryProgress } from '@/lib/types/hvac';
import { isItemDone } from '@/lib/types/hvac';

interface Props {
  params: Promise<{ taskId: string }>;
}

export const dynamic = 'force-dynamic';

export default async function TaskOverviewPage({ params }: Props) {
  const { taskId } = await params;

  const [task, depItems] = await Promise.all([
    prisma.hvacTask.findUnique({ where: { id: taskId } }),
    prisma.dependencyItem.findMany({
      where: { taskId },
      include: { completion: true },
    }),
  ]);

  if (!task) notFound();

  const locked = isLocked(task.status);

  const categories = ['architect', 'client', 'consultant', 'contractor', 'inspector'] as const;
  const progress: CategoryProgress[] = categories.map((cat) => {
    const items = depItems.filter((i) => i.category === cat);
    const completed = items.filter((i) => isItemDone(i.completion?.status as never)).length;
    const total = items.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return {
      taskId,
      category: cat,
      totalItems: total,
      completedItems: completed,
      completionPct: pct,
      categoryComplete: total > 0 && completed === total,
    };
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Task info */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-4">
            Task Information
          </h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-muted-foreground">Task Name</dt>
              <dd className="text-sm font-medium">{task.taskName}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Project</dt>
              <dd className="text-sm font-medium">{task.projectName}</dd>
            </div>
            {task.description && (
              <div>
                <dt className="text-xs text-muted-foreground">Description</dt>
                <dd className="text-sm text-muted-foreground leading-relaxed">{task.description}</dd>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs text-muted-foreground">Created</dt>
                <dd className="text-sm font-mono">{formatDate(task.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Due Date</dt>
                <dd className="text-sm font-mono">{formatDate(task.dueDate)}</dd>
              </div>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Last Updated</dt>
              <dd className="text-sm font-mono text-muted-foreground">{formatDateTime(task.updatedAt)}</dd>
            </div>
          </dl>
        </div>

        {!locked && (
          <div className="border-t border-border pt-4">
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">
              Actions
            </h2>
            <TaskStatusControl taskId={taskId} currentStatus={task.status} />
            {task.status === 'blocked' && (
              <p className="text-xs text-red-500 mt-2">
                This task is blocked. Complete all dependency items to unlock it.
              </p>
            )}
            {task.status === 'draft' && (
              <p className="text-xs text-muted-foreground mt-2">
                Complete all 4 dependency categories to move to Ready.
              </p>
            )}
          </div>
        )}

        {locked && (
          <div className="rounded-md border border-green-500/30 bg-green-500/5 px-4 py-3">
            <p className="text-sm text-green-700 dark:text-green-400 font-semibold">
              This task is complete and locked.
            </p>
          </div>
        )}
      </div>

      {/* Dependency progress */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-4">
            Dependency Progress
          </h2>
          <div className="border border-border rounded-lg p-4 mb-4">
            <OverallProgress progress={progress} />
          </div>
          <DependencyProgress progress={progress} />
        </div>
      </div>
    </div>
  );
}
