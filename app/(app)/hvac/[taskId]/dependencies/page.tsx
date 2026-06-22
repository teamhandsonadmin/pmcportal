import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { DependencyChecklist } from '@/components/hvac/DependencyChecklist';
import { isLocked } from '@/lib/utils/status-rules';
import type { DependencyCategory, DependencyItem } from '@/lib/types/hvac';

const CATEGORIES: DependencyCategory[] = ['architect', 'client', 'consultant', 'contractor', 'inspector'];

interface Props {
  params: Promise<{ taskId: string }>;
}

export const dynamic = 'force-dynamic';

export default async function TaskDependenciesPage({ params }: Props) {
  const { taskId } = await params;

  const [task, rawItems] = await Promise.all([
    prisma.hvacTask.findUnique({ where: { id: taskId }, select: { status: true } }),
    prisma.dependencyItem.findMany({
      where: { taskId },
      include: { completion: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);

  if (!task) notFound();

  const items: DependencyItem[] = rawItems.map((item) => ({
    id: item.id,
    taskId: item.taskId,
    category: item.category as DependencyCategory,
    itemLabel: item.itemLabel,
    isMandatory: item.isMandatory,
    sortOrder: item.sortOrder,
    createdAt: item.createdAt,
    completion: item.completion
      ? {
          id: item.completion.id,
          itemId: item.completion.itemId,
          status: item.completion.status as import('@/lib/types/hvac').CompletionStatus,
          comment: item.completion.comment,
          completedBy: item.completion.completedBy,
          completedAt: item.completion.completedAt,
          updatedAt: item.completion.updatedAt,
        }
      : null,
  }));

  const locked = isLocked(task.status);

  return (
    <div>
      {locked && (
        <div className="mb-6 rounded-md border border-green-500/30 bg-green-500/5 px-4 py-3">
          <p className="text-sm text-green-700 dark:text-green-400">
            Task is complete. Dependencies are read-only.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {CATEGORIES.map((category) => (
          <DependencyChecklist
            key={category}
            taskId={taskId}
            category={category}
            items={items.filter((i) => i.category === category)}
            locked={locked}
          />
        ))}
      </div>
    </div>
  );
}
