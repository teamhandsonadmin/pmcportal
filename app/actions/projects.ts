'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { UpdateProjectLocationSchema } from '@/lib/validations/projects';
import type { ActionResult } from '@/lib/types/hvac';

const CreateProjectSchema = z.object({
  name:     z.string().min(2).max(200),
  address:  z.string().max(500).optional().nullable(),
  area:     z.string().max(50).optional().nullable(),
  budget:   z.string().max(100).optional().nullable(),
  photoUrl: z.string().url().optional().nullable().or(z.literal('')),
});

export async function createProject(_prev: unknown, formData: FormData) {
  const raw = {
    name:     formData.get('name'),
    address:  formData.get('address') || null,
    area:     formData.get('area') || null,
    budget:   formData.get('budget') || null,
    photoUrl: formData.get('photoUrl') || null,
  };

  const parsed = CreateProjectSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Validation failed' };
  }

  const d = parsed.data;
  const project = await prisma.project.create({
    data: {
      name:     d.name,
      address:  d.address ?? null,
      area:     d.area ?? null,
      budget:   d.budget ?? null,
      photoUrl: d.photoUrl || null,
    },
  });

  redirect(`/projects/${project.id}`);
}

export async function updateProjectLocation(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const parsed = UpdateProjectLocationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const { projectId, siteLatitude, siteLongitude } = parsed.data;

  try {
    await prisma.project.update({
      where: { id: projectId },
      data: { siteLatitude, siteLongitude },
    });
  } catch {
    return { success: false, error: 'Failed to save site location.' };
  }

  await prisma.activityLog.create({
    data: {
      actionType: 'site_location_updated',
      payload: { projectId, siteLatitude, siteLongitude },
    },
  }).catch(() => {});

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}
