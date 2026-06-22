'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { AddCommentSchema } from '@/lib/validations/hvac';
import type { ActionResult } from '@/lib/types/hvac';

export async function addComment(
  taskId: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const parsed = AddCommentSchema.safeParse({ comment: formData.get('comment') });
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  try {
    await prisma.activityLog.create({
      data: {
        taskId,
        actionType: 'comment',
        payload: { text: parsed.data.comment },
      },
    });
  } catch {
    return { success: false, error: 'Failed to post comment' };
  }

  revalidatePath(`/hvac/${taskId}/activity`);
  return { success: true };
}
