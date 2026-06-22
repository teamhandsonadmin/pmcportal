import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ActivityTimeline } from '@/components/hvac/ActivityTimeline';
import type { ActivityEvent } from '@/lib/types/hvac';

interface Props {
  params: Promise<{ taskId: string }>;
}

export const dynamic = 'force-dynamic';

export default async function TaskActivityPage({ params }: Props) {
  const { taskId } = await params;

  const [task, logs] = await Promise.all([
    prisma.hvacTask.findUnique({ where: { id: taskId }, select: { id: true } }),
    prisma.activityLog.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  if (!task) notFound();

  const events: ActivityEvent[] = logs.map((log) => ({
    id: log.id,
    taskId: log.taskId ?? taskId,
    userId: log.userId,
    actionType: log.actionType as ActivityEvent['actionType'],
    payload: log.payload as Record<string, unknown> | null,
    createdAt: log.createdAt,
  }));

  return (
    <div className="max-w-xl">
      <ActivityTimeline events={events} />
    </div>
  );
}
