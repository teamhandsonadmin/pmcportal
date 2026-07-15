'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { UpdateProjectLocationSchema, UpdateProjectTotalSftSchema, UpdateProjectInfoSchema } from '@/lib/validations/projects';
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
  const raw = {
    projectId: formData.get('projectId'),
    siteLatitude: formData.get('siteLatitude'),
    siteLongitude: formData.get('siteLongitude'),
    siteRadiusMeters: formData.get('siteRadiusMeters') || null,
  };

  const parsed = UpdateProjectLocationSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const { projectId, siteLatitude, siteLongitude, siteRadiusMeters } = parsed.data;

  try {
    await prisma.project.update({
      where: { id: projectId },
      data: { siteLatitude, siteLongitude, siteRadiusMeters: siteRadiusMeters ?? null },
    });
  } catch {
    return { success: false, error: 'Failed to save site location.' };
  }

  await prisma.activityLog.create({
    data: {
      actionType: 'site_location_updated',
      payload: { projectId, siteLatitude, siteLongitude, siteRadiusMeters },
    },
  }).catch(() => {});

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/settings`);
  return { success: true };
}

// Project-wide SFT target, separate from any individual HvacTask.totalSft.
// Direct positional args (not a FormData/useActionState form action) —
// matches updateTaskTotalSft's own pattern for the equivalent per-task field.
export async function updateProjectTotalSft(projectId: string, totalSft: number): Promise<ActionResult> {
  const parsed = UpdateProjectTotalSftSchema.safeParse({ projectId, totalSft });
  if (!parsed.success) {
    return { success: false, error: 'Invalid total SFT value' };
  }

  try {
    await prisma.project.update({
      where: { id: parsed.data.projectId },
      data: { totalSft: parsed.data.totalSft },
    });
  } catch {
    return { success: false, error: 'Failed to update total SFT' };
  }

  await prisma.activityLog.create({
    data: {
      actionType: 'project_sft_target_updated',
      payload: { projectId: parsed.data.projectId, totalSft: parsed.data.totalSft },
    },
  }).catch(() => {});

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/settings`);
  return { success: true };
}

export async function updateProjectInfo(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const raw = {
    projectId: formData.get('projectId'),
    name:      formData.get('name'),
    address:   formData.get('address') || null,
    area:      formData.get('area') || null,
    budget:    formData.get('budget') || null,
    photoUrl:  formData.get('photoUrl') || null,
  };

  const parsed = UpdateProjectInfoSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const { projectId, name, address, area, budget, photoUrl } = parsed.data;

  try {
    await prisma.project.update({
      where: { id: projectId },
      data: { name, address: address ?? null, area: area ?? null, budget: budget ?? null, photoUrl: photoUrl || null },
    });
  } catch {
    return { success: false, error: 'Failed to save project info.' };
  }

  await prisma.activityLog.create({
    data: {
      actionType: 'project_info_updated',
      payload: { projectId, name, address, area, budget, photoUrl },
    },
  }).catch(() => {});

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/settings`);
  return { success: true };
}
