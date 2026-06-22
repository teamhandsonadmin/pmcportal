'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

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
