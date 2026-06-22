'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const CreateUserSchema = z.object({
  fullName: z.string().min(2).max(100),
  email:    z.string().email(),
  phone:    z.string().max(20).optional().nullable(),
  role:     z.enum(['senior_site_engineer', 'site_engineer']),
});

export async function createUser(_prev: unknown, formData: FormData) {
  const raw = {
    fullName: formData.get('fullName'),
    email:    formData.get('email'),
    phone:    formData.get('phone') || null,
    role:     formData.get('role'),
  };
  const parsed = CreateUserSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Validation failed' };
  }
  try {
    const user = await prisma.userProfile.create({
      data: {
        fullName: parsed.data.fullName,
        email:    parsed.data.email,
        phone:    parsed.data.phone ?? null,
        role:     parsed.data.role,
        status:   'invited',
        isActive: false,
      },
    });
    revalidatePath('/access');
    return { success: true as const, userId: user.id };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('unique') || msg.includes('Unique')) {
      return { success: false as const, error: 'A user with this email already exists.' };
    }
    return { success: false as const, error: 'Failed to create user. Please try again.' };
  }
}

export async function updateUserRole(userId: string, role: 'admin' | 'senior_site_engineer' | 'site_engineer') {
  await prisma.userProfile.update({ where: { id: userId }, data: { role } });
  revalidatePath('/access');
  return { success: true };
}

export async function updateUserStatus(userId: string, status: 'active' | 'invited' | 'disabled') {
  await prisma.userProfile.update({
    where: { id: userId },
    data: { status, isActive: status === 'active' },
  });
  revalidatePath('/access');
  return { success: true };
}

export async function deleteUser(userId: string) {
  await prisma.userProfile.delete({ where: { id: userId } });
  revalidatePath('/access');
  return { success: true };
}
