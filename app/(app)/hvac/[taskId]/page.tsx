import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { TrelloTaskDetail } from '@/components/hvac/TrelloTaskDetail';
import { isLocked } from '@/lib/utils/status-rules';
import { DEPENDENCY_DEFAULTS } from '@/lib/constants/dependency-defaults';
import type { DependencyCategory, DependencyItem } from '@/lib/types/hvac';

const CATEGORIES: DependencyCategory[] = ['architect', 'client', 'consultant', 'contractor', 'inspector'];

interface Props {
  params: Promise<{ taskId: string }>;
}

export const dynamic = 'force-dynamic';

export default async function TaskDetailPage({ params }: Props) {
  const { taskId } = await params;

  const [task, rawItems] = await Promise.all([
    prisma.hvacTask.findUnique({
      where: { id: taskId },
      include: { work: { select: { id: true, name: true, color: true, code: true } } },
    }),
    prisma.dependencyItem.findMany({
      where: { taskId },
      include: { completion: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);

  if (!task) notFound();

  // Auto-seed dependency items for tasks that have none (e.g. created before seeding was added)
  let seedItems = rawItems;
  if (rawItems.length === 0) {
    const categories = Object.keys(DEPENDENCY_DEFAULTS) as Array<keyof typeof DEPENDENCY_DEFAULTS>;
    for (const category of categories) {
      const labels = DEPENDENCY_DEFAULTS[category];
      for (let idx = 0; idx < labels.length; idx++) {
        await prisma.dependencyItem.create({
          data: { taskId, category, itemLabel: labels[idx], sortOrder: idx },
        }).catch(() => {});
      }
    }
    seedItems = await prisma.dependencyItem.findMany({
      where: { taskId },
      include: { completion: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  const items: DependencyItem[] = seedItems.map((item) => ({
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
    <TrelloTaskDetail
      task={{
        id: task.id,
        taskId: task.taskId,
        taskName: task.taskName,
        projectName: task.projectName,
        description: task.description,
        status: task.status,
        dueDate: task.dueDate,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        work: task.work,
      }}
      items={items}
      categories={CATEGORIES}
      locked={locked}
    />
  );
}
