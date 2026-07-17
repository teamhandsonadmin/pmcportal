import { prisma } from '@/lib/prisma';
import { addDays, startOfDay } from 'date-fns';
import { upcomingDateLabel } from '@/lib/data/report';
import type { CompletionStatus } from '@/lib/types/hvac';

// "Needs attention" = anything except the two clearing statuses (YES,
// PROCEED) — kept in exact sync with site-engineer-app's
// dependencyAlerts.ts (NEEDS_ATTENTION_STATUSES) and the Postgres push
// trigger in supabase/push-notifications.sql. All three must move together.
const CLEARED_STATUSES: CompletionStatus[] = ['YES', 'PROCEED'];
const FLAGGED_STATUSES: CompletionStatus[] = ['ON_HOLD', 'NO'];

export interface NeedsAttentionItem {
  itemId: string;
  itemLabel: string;
  taskId: string;
  taskName: string;
  workName: string;
  projectName: string;
  status: CompletionStatus;
  isFlagged: boolean;
  pendingSince: Date;
}

// A completion row is created lazily (see DependencyCompletion's own schema
// comment) — "no row yet" is implicitly PENDING, matching every other
// consumer of this checklist data in both repos. The OR below is what
// captures that: either no completion row exists at all, or one exists
// with a status outside the two clearing values.
export async function getNeedsAttentionItems(): Promise<NeedsAttentionItem[]> {
  const items = await prisma.dependencyItem.findMany({
    where: {
      category: 'client',
      OR: [
        { completion: null },
        { completion: { status: { notIn: CLEARED_STATUSES } } },
      ],
    },
    select: {
      id: true,
      itemLabel: true,
      createdAt: true,
      task: {
        select: {
          id: true,
          taskName: true,
          work: { select: { name: true, project: { select: { name: true } } } },
        },
      },
      completion: { select: { status: true, updatedAt: true } },
    },
  });

  return items
    .filter((i) => i.task?.work?.project)
    .map((i) => {
      const status = i.completion?.status ?? 'PENDING';
      return {
        itemId: i.id,
        itemLabel: i.itemLabel,
        taskId: i.task!.id,
        taskName: i.task!.taskName,
        workName: i.task!.work!.name,
        projectName: i.task!.work!.project!.name,
        status,
        isFlagged: FLAGGED_STATUSES.includes(status),
        pendingSince: i.completion?.updatedAt ?? i.createdAt,
      };
    })
    .sort((a, b) => a.pendingSince.getTime() - b.pendingSince.getTime());
}

export interface UpcomingTaskItem {
  id: string;
  taskName: string;
  workName: string;
  projectName: string;
  plannedStartDate: Date;
  dateLabel: string;
}

// Same date-range/status-exclusion logic as site-engineer-app's
// lib/tasks/upcomingTasks.ts (30-day window, excludes in_progress/completed)
// — ported rather than re-derived, so both apps agree on what "upcoming"
// means. deletedAt filter added since this queries across ALL projects
// (admin-web has no per-project scoping for this global panel, matching
// getWorksData()'s own established convention).
export async function getUpcomingTasksForNotifications(): Promise<UpcomingTaskItem[]> {
  const today = startOfDay(new Date());
  const windowEnd = addDays(today, 30);

  const tasks = await prisma.hvacTask.findMany({
    where: {
      deletedAt: null,
      plannedStartDate: { gte: today, lte: windowEnd },
      status: { notIn: ['in_progress', 'completed'] },
    },
    select: {
      id: true,
      taskName: true,
      plannedStartDate: true,
      work: { select: { name: true, project: { select: { name: true } } } },
    },
    orderBy: { plannedStartDate: 'asc' },
  });

  return tasks
    .filter((t) => t.plannedStartDate)
    .map((t) => ({
      id: t.id,
      taskName: t.taskName,
      workName: t.work?.name ?? 'Unassigned',
      projectName: t.work?.project?.name ?? 'Unknown project',
      plannedStartDate: t.plannedStartDate!,
      dateLabel: upcomingDateLabel(t.plannedStartDate!, today),
    }));
}
