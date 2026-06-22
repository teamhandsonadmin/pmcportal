'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { CreateTaskSchema, UpdateTaskStatusSchema } from '@/lib/validations/hvac';
import type { ActionResult } from '@/lib/types/hvac';
import { DEPENDENCY_DEFAULTS } from '@/lib/constants/dependency-defaults';

export async function createHvacTask(
  _prevState: ActionResult<{ taskId: string }>,
  formData: FormData
): Promise<ActionResult<{ taskId: string }>> {
  const parsed = CreateTaskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  let task;
  try {
    // Use the work's code as the task ID prefix
    let prefix = 'WRK';
    try {
      const work = await prisma.work.findUnique({ where: { id: parsed.data.work_id }, select: { code: true } });
      if (work) prefix = work.code;
    } catch { /* fallback */ }

    task = await prisma.hvacTask.create({
      data: {
        taskId: `${prefix}-${Date.now().toString().slice(-6)}`,
        taskName: parsed.data.task_name,
        projectName: parsed.data.project_name,
        description: parsed.data.description ?? null,
        dueDate: parsed.data.due_date ? new Date(parsed.data.due_date) : null,
        workId: parsed.data.work_id,
      },
      select: { id: true, taskId: true },
    });
  } catch {
    return { success: false, error: 'Failed to create task. Please try again.' };
  }

  // Auto-seed dependency checklist items for all 5 categories
  const categories = Object.keys(DEPENDENCY_DEFAULTS) as Array<keyof typeof DEPENDENCY_DEFAULTS>;
  for (const category of categories) {
    const labels = DEPENDENCY_DEFAULTS[category];
    for (let idx = 0; idx < labels.length; idx++) {
      await prisma.dependencyItem.create({
        data: {
          taskId: task.id,
          category: category,
          itemLabel: labels[idx],
          sortOrder: idx,
        },
      }).catch(() => {});
    }
  }

  await prisma.activityLog.create({
    data: {
      taskId: task.id,
      actionType: 'task_created',
      payload: { taskId: task.taskId },
    },
  }).catch(() => {});

  revalidatePath('/hvac');
  redirect(`/hvac/${task.id}`);
}

export async function updateTaskStatus(
  taskId: string,
  status: string
): Promise<ActionResult> {
  const parsed = UpdateTaskStatusSchema.safeParse({ status });
  if (!parsed.success) {
    return { success: false, error: 'Invalid status value' };
  }

  let existing;
  try {
    existing = await prisma.hvacTask.findUnique({
      where: { id: taskId },
      select: { status: true },
    });
  } catch {
    return { success: false, error: 'Task not found' };
  }

  if (!existing) return { success: false, error: 'Task not found' };
  if (existing.status === 'completed') return { success: false, error: 'Completed tasks are locked' };

  if (parsed.data.status === 'in_progress' && existing.status !== 'ready') {
    return { success: false, error: 'Task must be in Ready state before starting' };
  }

  try {
    await prisma.hvacTask.update({
      where: { id: taskId },
      data: { status: parsed.data.status as never },
    });
  } catch {
    return { success: false, error: 'Failed to update status' };
  }

  await prisma.activityLog.create({
    data: {
      taskId,
      actionType: 'status_change',
      payload: { from: existing.status, to: parsed.data.status },
    },
  }).catch(() => {});

  revalidatePath(`/hvac/${taskId}`);
  revalidatePath('/hvac');
  return { success: true };
}

export async function deleteHvacTask(taskId: string): Promise<ActionResult> {
  let task;
  try {
    task = await prisma.hvacTask.findUnique({
      where: { id: taskId },
      select: { status: true },
    });
  } catch {
    return { success: false, error: 'Task not found' };
  }

  if (!task) return { success: false, error: 'Task not found' };
  if (task.status === 'completed') return { success: false, error: 'Completed tasks cannot be deleted' };

  try {
    await prisma.hvacTask.delete({ where: { id: taskId } });
  } catch {
    return { success: false, error: 'Failed to delete task' };
  }

  revalidatePath('/hvac');
  redirect('/hvac');
}
