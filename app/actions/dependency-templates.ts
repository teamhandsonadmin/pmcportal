'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { AddTemplateItemSchema } from '@/lib/validations/hvac';
import type { ActionResult } from '@/lib/types/hvac';

export async function addTemplateItem(formData: FormData): Promise<ActionResult> {
  const parsed = AddTemplateItemSchema.safeParse({
    category: formData.get('category'),
    label: formData.get('label'),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const maxSort = await prisma.dependencyTemplateItem.aggregate({
    where: { category: parsed.data.category },
    _max: { sortOrder: true },
  });

  try {
    await prisma.dependencyTemplateItem.create({
      data: {
        category: parsed.data.category,
        label: parsed.data.label,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    });
  } catch {
    return { success: false, error: 'Failed to add item' };
  }

  revalidatePath('/tasks');
  return { success: true };
}

export async function updateTemplateItem(id: string, label: string): Promise<ActionResult> {
  if (!label.trim()) return { success: false, error: 'Label cannot be empty' };

  try {
    await prisma.dependencyTemplateItem.update({ where: { id }, data: { label: label.trim() } });
  } catch {
    return { success: false, error: 'Failed to update item' };
  }

  revalidatePath('/tasks');
  return { success: true };
}

export async function deleteTemplateItem(id: string): Promise<ActionResult> {
  try {
    await prisma.dependencyTemplateItem.delete({ where: { id } });
  } catch {
    return { success: false, error: 'Failed to delete item' };
  }

  revalidatePath('/tasks');
  return { success: true };
}

export async function reorderTemplateItem(id: string, direction: 'up' | 'down'): Promise<ActionResult> {
  const item = await prisma.dependencyTemplateItem.findUnique({ where: { id } });
  if (!item) return { success: false, error: 'Item not found' };

  const neighbor = await prisma.dependencyTemplateItem.findFirst({
    where: {
      category: item.category,
      sortOrder: direction === 'up' ? { lt: item.sortOrder } : { gt: item.sortOrder },
    },
    orderBy: { sortOrder: direction === 'up' ? 'desc' : 'asc' },
  });
  if (!neighbor) return { success: true };

  try {
    await prisma.$transaction([
      prisma.dependencyTemplateItem.update({ where: { id: item.id }, data: { sortOrder: neighbor.sortOrder } }),
      prisma.dependencyTemplateItem.update({ where: { id: neighbor.id }, data: { sortOrder: item.sortOrder } }),
    ]);
  } catch {
    return { success: false, error: 'Failed to reorder item' };
  }

  revalidatePath('/tasks');
  return { success: true };
}

export async function applyTemplateToProject(projectId: string): Promise<ActionResult<{ created: number }>> {
  const [templateItems, tasks] = await Promise.all([
    prisma.dependencyTemplateItem.findMany(),
    prisma.hvacTask.findMany({
      where: { work: { projectId } },
      select: { id: true, dependencyItems: { select: { category: true, itemLabel: true } } },
    }),
  ]);

  if (tasks.length === 0) return { success: true, data: { created: 0 } };

  let created = 0;
  for (const task of tasks) {
    const existing = new Set(task.dependencyItems.map((i) => `${i.category}:${i.itemLabel}`));
    const missing = templateItems.filter((ti) => !existing.has(`${ti.category}:${ti.label}`));
    if (missing.length === 0) continue;

    await prisma.dependencyItem.createMany({
      data: missing.map((ti) => ({
        taskId: task.id,
        category: ti.category,
        itemLabel: ti.label,
        sortOrder: ti.sortOrder,
      })),
    });
    created += missing.length;
  }

  revalidatePath('/tasks');
  revalidatePath('/works');
  return { success: true, data: { created } };
}
