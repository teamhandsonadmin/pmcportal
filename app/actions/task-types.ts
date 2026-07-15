'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { TaskTypeSchema } from '@/lib/validations/hvac';
import type { ActionResult } from '@/lib/types/hvac';

export async function createTaskType(data: { name: string; defaultDurationDays: number }): Promise<ActionResult<{ id: string }>> {
  const parsed = TaskTypeSchema.safeParse({ name: data.name, default_duration_days: data.defaultDurationDays });
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  let created;
  try {
    created = await prisma.taskType.create({
      data: { name: parsed.data.name, defaultDurationDays: parsed.data.default_duration_days },
      select: { id: true },
    });
  } catch {
    return { success: false, error: 'A task type with that name already exists, or failed to save.' };
  }

  revalidatePath('/works');
  return { success: true, data: { id: created.id } };
}

export async function updateTaskType(id: string, data: { name: string; defaultDurationDays: number }): Promise<ActionResult> {
  const parsed = TaskTypeSchema.safeParse({ name: data.name, default_duration_days: data.defaultDurationDays });
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  try {
    await prisma.taskType.update({
      where: { id },
      data: { name: parsed.data.name, defaultDurationDays: parsed.data.default_duration_days },
    });
  } catch {
    return { success: false, error: 'A task type with that name already exists, or failed to save.' };
  }

  revalidatePath('/works');
  return { success: true };
}

export async function deleteTaskType(id: string): Promise<ActionResult> {
  const inUse = await prisma.hvacTask.count({ where: { taskTypeId: id } }).catch(() => 0);
  if (inUse > 0) {
    return { success: false, error: `Can't delete — ${inUse} task${inUse === 1 ? '' : 's'} still use${inUse === 1 ? 's' : ''} this type.` };
  }

  try {
    await prisma.taskType.delete({ where: { id } });
  } catch {
    return { success: false, error: 'Failed to delete task type' };
  }

  revalidatePath('/works');
  return { success: true };
}
