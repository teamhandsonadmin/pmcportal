'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { CreateInventoryItemSchema, CreateInventoryTransactionSchema } from '@/lib/validations/inventory';
import type { ActionResult } from '@/lib/types/tasks';

export async function createInventoryItem(
  _prevState: ActionResult<{ itemId: string }>,
  formData: FormData
): Promise<ActionResult<{ itemId: string }>> {
  const parsed = CreateInventoryItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const d = parsed.data;
  let item;
  try {
    item = await prisma.inventoryItem.create({
      data: {
        name: d.name,
        sku: d.sku || null,
        category: d.category || null,
        unit: d.unit,
        reorderLevel: d.reorderLevel ?? null,
        unitCost: d.unitCost ?? null,
        supplier: d.supplier || null,
        projectId: d.projectId || null,
        notes: d.notes || null,
      },
      select: { id: true },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('Unique constraint') || msg.includes('unique')) {
      return { success: false, error: { sku: ['This SKU is already in use'] } };
    }
    return { success: false, error: 'Failed to create item. Please try again.' };
  }

  await prisma.activityLog.create({
    data: {
      actionType: 'inventory_item_created',
      payload: { itemId: item.id, name: d.name },
    },
  }).catch(() => {});

  revalidatePath('/inventory');
  redirect(`/inventory/${item.id}`);
}

export async function updateInventoryItem(itemId: string, formData: FormData): Promise<ActionResult> {
  const parsed = CreateInventoryItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const d = parsed.data;
  try {
    await prisma.inventoryItem.update({
      where: { id: itemId },
      data: {
        name: d.name,
        sku: d.sku || null,
        category: d.category || null,
        unit: d.unit,
        reorderLevel: d.reorderLevel ?? null,
        unitCost: d.unitCost ?? null,
        supplier: d.supplier || null,
        projectId: d.projectId || null,
        notes: d.notes || null,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('Unique constraint') || msg.includes('unique')) {
      return { success: false, error: { sku: ['This SKU is already in use'] } };
    }
    return { success: false, error: 'Failed to update item.' };
  }

  revalidatePath('/inventory');
  revalidatePath(`/inventory/${itemId}`);
  return { success: true };
}

export async function deleteInventoryItem(itemId: string): Promise<ActionResult> {
  const txCount = await prisma.inventoryTransaction.count({ where: { itemId } }).catch(() => 0);
  if (txCount > 0) {
    return {
      success: false,
      error: 'Cannot delete an item with transaction history. This would destroy the audit trail.',
    };
  }

  try {
    await prisma.inventoryItem.delete({ where: { id: itemId } });
  } catch {
    return { success: false, error: 'Failed to delete item.' };
  }

  revalidatePath('/inventory');
  return { success: true };
}

export async function createInventoryTransaction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const parsed = CreateInventoryTransactionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const { itemId, type, quantity, sourceDocPath, note } = parsed.data;

  if (type !== 'ADJUSTMENT' && quantity <= 0) {
    return { success: false, error: { quantity: ['Quantity must be greater than 0 for IN/OUT transactions'] } };
  }
  if (type === 'ADJUSTMENT' && quantity < 0) {
    return { success: false, error: { quantity: ['Adjusted quantity cannot be negative'] } };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUnique({ where: { id: itemId }, select: { quantityOnHand: true } });
      if (!item) throw new Error('ITEM_NOT_FOUND');

      const current = Number(item.quantityOnHand);
      let newQty: number;
      if (type === 'IN') newQty = current + quantity;
      else if (type === 'OUT') {
        newQty = current - quantity;
        if (newQty < 0) throw new Error('NEGATIVE_STOCK');
      } else {
        newQty = quantity;
      }

      await tx.inventoryTransaction.create({
        data: { itemId, type, quantity, sourceDocPath: sourceDocPath || null, note: note || null },
      });
      await tx.inventoryItem.update({ where: { id: itemId }, data: { quantityOnHand: newQty } });
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'NEGATIVE_STOCK') {
      return {
        success: false,
        error: { quantity: ['This would take stock negative. Current available quantity is insufficient.'] },
      };
    }
    if (e instanceof Error && e.message === 'ITEM_NOT_FOUND') {
      return { success: false, error: 'Item not found' };
    }
    return { success: false, error: 'Failed to record transaction.' };
  }

  await prisma.activityLog.create({
    data: {
      actionType: 'inventory_transaction_recorded',
      payload: { itemId, type, quantity },
    },
  }).catch(() => {});

  revalidatePath('/inventory');
  revalidatePath(`/inventory/${itemId}`);
  return { success: true };
}
