'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { AddHolidaySchema } from '@/lib/validations/hvac';
import type { ActionResult } from '@/lib/types/hvac';

export async function addHoliday(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const parsed = AddHolidaySchema.safeParse({
    date: formData.get('date'),
    name: formData.get('name'),
    description: formData.get('description') || null,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  try {
    await prisma.holiday.create({
      data: {
        date: new Date(parsed.data.date),
        name: parsed.data.name,
        description: parsed.data.description ?? null,
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
