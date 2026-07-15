'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { AddHolidaySchema } from '@/lib/validations/hvac';
import type { ActionResult } from '@/lib/types/hvac';

export async function addHoliday(data: { date: string; name: string; type: string }): Promise<ActionResult> {
  const parsed = AddHolidaySchema.safeParse({ date: data.date, name: data.name, type: data.type });

  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  try {
    await prisma.holiday.create({
      data: {
        date: new Date(parsed.data.date),
        name: parsed.data.name,
        type: parsed.data.type as never,
      },
    });
  } catch {
    return { success: false, error: 'Holiday already exists for that date, or failed to save.' };
  }

  revalidatePath('/calendar');
  return { success: true };
}

export async function updateHoliday(id: string, data: { date: string; name: string; type: string }): Promise<ActionResult> {
  const parsed = AddHolidaySchema.safeParse({ date: data.date, name: data.name, type: data.type });
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  try {
    await prisma.holiday.update({
      where: { id },
      data: {
        date: new Date(parsed.data.date),
        name: parsed.data.name,
        type: parsed.data.type as never,
      },
    });
  } catch {
    return { success: false, error: 'Holiday already exists for that date, or failed to save.' };
  }

  revalidatePath('/calendar');
  return { success: true };
}

export async function deleteHoliday(id: string): Promise<ActionResult> {
  try {
    await prisma.holiday.delete({ where: { id } });
  } catch {
    return { success: false, error: 'Failed to delete holiday' };
  }
  revalidatePath('/calendar');
  return { success: true };
}
