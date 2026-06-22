'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { UpdateDependencySchema } from '@/lib/validations/hvac';
import type { ActionResult, CompletionStatus } from '@/lib/types/hvac';

export async function updateDependencyCompletion(
  itemId: string,
  taskId: string,
  status: CompletionStatus,
  comment?: string | null
): Promise<ActionResult> {
  const parsed = UpdateDependencySchema.safeParse({ status, comment: comment ?? null });

  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  try {
    await prisma.dependencyCompletion.upsert({
      where: { itemId },
      create: {
        itemId,
        status: parsed.data.status as never,
        comment: parsed.data.comment ?? null,
        completedAt: parsed.data.status === 'delivered' ? new Date() : null,
      },
      update: {
        status: parsed.data.status as never,
        comment: parsed.data.comment ?? null,
        completedAt: parsed.data.status === 'delivered' ? new Date() : null,
      },
    });
  } catch {
    return { success: false, error: 'Failed to update checklist item' };
  }

  await prisma.activityLog.create({
    data: {
      taskId,
      actionType: 'checklist_update',
      payload: { itemId, status: parsed.data.status },
    },
  }).catch(() => {});

  revalidatePath(`/hvac/${taskId}/dependencies`);
  revalidatePath(`/hvac/${taskId}/overview`);
  revalidatePath('/hvac');
  return { success: true };
}
