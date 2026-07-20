import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { TrelloTaskDetail } from '@/components/tasks/TrelloTaskDetail';
import { isLocked } from '@/lib/utils/status-rules';
import type { DependencyCategory, DependencyItem } from '@/lib/types/tasks';

const CATEGORIES: DependencyCategory[] = ['architect', 'client', 'consultant', 'contractor', 'procurement', 'quantity'];

interface Props {
  params: Promise<{ taskId: string }>;
}

export const dynamic = 'force-dynamic';

export default async function TaskDetailPage({ params }: Props) {
  const { taskId } = await params;

  const [task, rawItems] = await Promise.all([
    prisma.task.findUnique({
      where: { id: taskId },
      include: { work: { select: { id: true, name: true, color: true, code: true } } },
    }),
    prisma.dependencyItem.findMany({
      where: { taskId },
      include: { completion: true, _count: { select: { comments: true } } },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);

  if (!task) notFound();

  const assignee = task.assignedTo
    ? await prisma.userProfile.findUnique({
        where: { id: task.assignedTo },
        select: { fullName: true, role: true },
      }).catch(() => null)
    : null;

  // Auto-seed dependency items for tasks that have none (e.g. created before seeding was added)
  let seedItems = rawItems;
  if (rawItems.length === 0) {
    const templateItems = await prisma.dependencyTemplateItem.findMany().catch(() => []);
    if (templateItems.length > 0) {
      await prisma.dependencyItem.createMany({
        data: templateItems.map((ti) => ({
          taskId,
          category: ti.category,
          itemLabel: ti.label,
          sortOrder: ti.sortOrder,
        })),
      }).catch(() => {});
      seedItems = await prisma.dependencyItem.findMany({
        where: { taskId },
        include: { completion: true, _count: { select: { comments: true } } },
        orderBy: { sortOrder: 'asc' },
      });
    }
  }

  const items: DependencyItem[] = seedItems.map((item) => ({
    id: item.id,
    taskId: item.taskId,
    category: item.category as DependencyCategory,
    itemLabel: item.itemLabel,
    isMandatory: item.isMandatory,
    sortOrder: item.sortOrder,
    createdAt: item.createdAt,
    commentCount: item._count.comments,
    completion: item.completion
      ? {
          id: item.completion.id,
          itemId: item.completion.itemId,
          status: item.completion.status as import('@/lib/types/tasks').CompletionStatus,
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
        plannedStartDate: task.plannedStartDate,
        dueDate: task.dueDate,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        work: task.work,
        assignee: assignee ? { fullName: assignee.fullName, role: assignee.role } : null,
      }}
      items={items}
      categories={CATEGORIES}
      locked={locked}
    />
  );
}
