'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/lib/types/tasks';

export async function markAttendanceReviewed(recordId: string): Promise<ActionResult> {
  try {
    await prisma.attendanceRecord.update({
      where: { id: recordId },
      data: { reviewedAt: new Date() },
    });
  } catch {
    return { success: false, error: 'Failed to mark record as reviewed.' };
  }

  await prisma.activityLog.create({
    data: {
      actionType: 'attendance_reviewed',
      payload: { recordId },
    },
  }).catch(() => {});

  revalidatePath('/attendance');
  return { success: true };
}
