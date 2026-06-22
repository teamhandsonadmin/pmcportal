'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { CreateWorkSchema } from '@/lib/validations/hvac';
import type { ActionResult } from '@/lib/types/hvac';

export async function createWork(
  _prevState: ActionResult<{ workId: string }>,
  formData: FormData
): Promise<ActionResult<{ workId: string }>> {
  const parsed = CreateWorkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const projectId = formData.get('project_id') as string | null;

  let work;
  try {
    work = await prisma.work.create({
      data: {
        name:        parsed.data.name,
        code:        parsed.data.code,
        description: parsed.data.description ?? null,
        color:       parsed.data.color,
        projectId:   projectId || null,
      },
      select: { id: true },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('Unique constraint') || msg.includes('unique')) {
      return { success: false, error: { code: ['This work code is already taken'] } };
    }
    return { success: false, error: 'Failed to create work. Please try again.' };
  }

  revalidatePath('/works');
  if (projectId) revalidatePath(`/projects/${projectId}`);
  redirect(`/works/${work.id}`);
}
