'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { cascadePlannedDatesFromActualDelay } from '@/app/actions/tasks';
import type { ActionResult } from '@/lib/types/tasks';

// Symmetric, non-blocking link — deliberately never read by updateTaskStatus,
// the delay engine, or any other gating logic anywhere in the app. See
// prisma/schema.prisma's TaskParallelLink comment for why.
async function revalidateTaskFamily(taskAId: string, taskBId: string) {
  revalidatePath(`/tasks/${taskAId}`);
  revalidatePath(`/tasks/${taskAId}/overview`);
  revalidatePath(`/tasks/${taskBId}`);
  revalidatePath(`/tasks/${taskBId}/overview`);
  revalidatePath('/works');
  revalidatePath('/works/flowchart');
}

export async function createParallelLink(taskAId: string, taskBId: string): Promise<ActionResult> {
  if (taskAId === taskBId) {
    return { success: false, error: 'A task cannot be linked in parallel with itself.' };
  }

  // Symmetric — check both (A,B) and (B,A) orderings so the same pair can
  // never be linked twice regardless of which node was clicked first.
  const existing = await prisma.taskParallelLink.findFirst({
    where: {
      OR: [
        { taskAId, taskBId },
        { taskAId: taskBId, taskBId: taskAId },
      ],
    },
  });
  if (existing) {
    return { success: false, error: 'These tasks are already linked in parallel.' };
  }

  try {
    await prisma.taskParallelLink.create({ data: { taskAId, taskBId } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('Unique constraint') || msg.includes('unique')) {
      return { success: false, error: 'These tasks are already linked in parallel.' };
    }
    return { success: false, error: 'Failed to create parallel link.' };
  }

  await prisma.activityLog.create({
    data: {
      taskId: taskAId,
      actionType: 'task_parallel_link_added',
      payload: { taskAId, taskBId },
    },
  }).catch(() => {});

  // Whichever side (if either) is already running late mirrors that delay
  // onto its new partner immediately — checked both ways since the link is
  // symmetric and either task could be the delayed one. No-ops harmlessly
  // for whichever side has no delay of its own to propagate.
  await Promise.all([
    cascadePlannedDatesFromActualDelay(taskAId).catch(() => {}),
    cascadePlannedDatesFromActualDelay(taskBId).catch(() => {}),
  ]);

  await revalidateTaskFamily(taskAId, taskBId);
  return { success: true };
}

// Updates an existing TaskParallelLink row's endpoints in place (not a
// delete+recreate) — same reasoning as reconnectTaskDependency in
// task-dependencies.ts: keeps the row's id, and any future audit trail
// keyed to it, continuous across a drag-to-reconnect on the canvas.
export async function reconnectParallelLink(
  linkId: string,
  newTaskAId: string,
  newTaskBId: string
): Promise<ActionResult> {
  if (newTaskAId === newTaskBId) {
    return { success: false, error: 'A task cannot be linked in parallel with itself.' };
  }

  const existing = await prisma.taskParallelLink.findUnique({
    where: { id: linkId },
    select: { taskAId: true, taskBId: true },
  }).catch(() => null);
  if (!existing) return { success: false, error: 'Parallel link not found' };

  const duplicate = await prisma.taskParallelLink.findFirst({
    where: {
      id: { not: linkId },
      OR: [
        { taskAId: newTaskAId, taskBId: newTaskBId },
        { taskAId: newTaskBId, taskBId: newTaskAId },
      ],
    },
  });
  if (duplicate) {
    return { success: false, error: 'These tasks are already linked in parallel.' };
  }

  try {
    await prisma.taskParallelLink.update({
      where: { id: linkId },
      data: { taskAId: newTaskAId, taskBId: newTaskBId },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('Unique constraint') || msg.includes('unique')) {
      return { success: false, error: 'These tasks are already linked in parallel.' };
    }
    return { success: false, error: 'Failed to reconnect parallel link.' };
  }

  await prisma.activityLog.create({
    data: {
      taskId: newTaskAId,
      actionType: 'task_parallel_link_reconnected',
      payload: {
        linkId,
        oldTaskAId: existing.taskAId,
        oldTaskBId: existing.taskBId,
        newTaskAId,
        newTaskBId,
      },
    },
  }).catch(() => {});

  await revalidateTaskFamily(existing.taskAId, existing.taskBId);
  await revalidateTaskFamily(newTaskAId, newTaskBId);
  return { success: true };
}

export async function removeParallelLink(linkId: string): Promise<ActionResult> {
  let link;
  try {
    link = await prisma.taskParallelLink.findUnique({
      where: { id: linkId },
      select: { taskAId: true, taskBId: true },
    });
  } catch {
    return { success: false, error: 'Parallel link not found' };
  }
  if (!link) return { success: false, error: 'Parallel link not found' };

  try {
    await prisma.taskParallelLink.delete({ where: { id: linkId } });
  } catch {
    return { success: false, error: 'Failed to remove parallel link' };
  }

  await prisma.activityLog.create({
    data: {
      taskId: link.taskAId,
      actionType: 'task_parallel_link_removed',
      payload: { taskAId: link.taskAId, taskBId: link.taskBId },
    },
  }).catch(() => {});

  await revalidateTaskFamily(link.taskAId, link.taskBId);
  return { success: true };
}
