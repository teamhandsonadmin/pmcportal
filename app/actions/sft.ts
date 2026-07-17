'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { CreateSftEntrySchema, UpdateTaskTotalSftSchema } from '@/lib/validations/hvac';
import type { ActionResult } from '@/lib/types/hvac';

async function revalidateTaskFamily(taskId: string) {
  revalidatePath(`/tasks/${taskId}/overview`);
  revalidatePath('/tasks');
  revalidatePath('/works');
  const task = await prisma.hvacTask.findUnique({
    where: { id: taskId },
    select: { workId: true, work: { select: { projectId: true } } },
  }).catch(() => null);
  if (task?.workId) revalidatePath(`/works/${task.workId}`);
  if (task?.work?.projectId) revalidatePath(`/projects/${task.work.projectId}`);
}

export async function addSftEntry(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const parsed = CreateSftEntrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const { taskId, entryDate, sftCompleted, headcount, notes } = parsed.data;

  try {
    await prisma.sftProgressEntry.create({
      data: {
        taskId,
        entryDate,
        sftCompleted,
        headcount: headcount ?? null,
        notes: notes || null,
      },
    });
  } catch {
    return { success: false, error: 'Failed to log SFT entry' };
  }

  await prisma.activityLog.create({
    data: {
      taskId,
      actionType: 'sft_progress_logged',
      payload: { sftCompleted, headcount: headcount ?? null },
    },
  }).catch(() => {});

  await revalidateTaskFamily(taskId);
  return { success: true };
}

export async function updateTaskTotalSft(taskId: string, totalSft: number): Promise<ActionResult> {
  const parsed = UpdateTaskTotalSftSchema.safeParse({ taskId, totalSft });
  if (!parsed.success) {
    return { success: false, error: 'Invalid total SFT value' };
  }

  try {
    await prisma.hvacTask.update({
      where: { id: taskId },
      data: { totalSft: parsed.data.totalSft },
    });
  } catch {
    return { success: false, error: 'Failed to update total SFT' };
  }

  await prisma.activityLog.create({
    data: {
      taskId,
      actionType: 'sft_target_updated',
      payload: { totalSft: parsed.data.totalSft },
    },
  }).catch(() => {});

  await revalidateTaskFamily(taskId);
  return { success: true };
}

export async function deleteSftEntry(entryId: string): Promise<ActionResult> {
  let entry;
  try {
    entry = await prisma.sftProgressEntry.findUnique({
      where: { id: entryId },
      select: { id: true, taskId: true },
    });
  } catch {
    return { success: false, error: 'Entry not found' };
  }

  if (!entry) return { success: false, error: 'Entry not found' };

  try {
    await prisma.sftProgressEntry.delete({ where: { id: entryId } });
  } catch {
    return { success: false, error: 'Failed to delete entry' };
  }

  await prisma.activityLog.create({
    data: {
      taskId: entry.taskId,
      actionType: 'sft_progress_deleted',
      payload: { entryId },
    },
  }).catch(() => {});

  await revalidateTaskFamily(entry.taskId);
  return { success: true };
}
