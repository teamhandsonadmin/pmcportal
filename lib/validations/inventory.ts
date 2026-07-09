import { z } from 'zod';

export const INVENTORY_UNITS = [
  'PCS', 'KG', 'TON', 'BAG', 'LITRE', 'SQFT', 'CUBIC_M', 'BOX', 'ROLL', 'OTHER',
] as const;

export const INVENTORY_TRANSACTION_TYPES = ['IN', 'OUT', 'ADJUSTMENT'] as const;

export const CreateInventoryItemSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(200),
  sku: z.string().max(50).optional().nullable().or(z.literal('')),
  category: z.string().max(100).optional().nullable().or(z.literal('')),
  unit: z.enum(INVENTORY_UNITS).default('PCS'),
  reorderLevel: z.coerce.number().min(0).optional(),
  unitCost: z.coerce.number().min(0).optional(),
  supplier: z.string().max(200).optional().nullable().or(z.literal('')),
  projectId: z.string().uuid().optional().nullable().or(z.literal('')),
  notes: z.string().max(2000).optional().nullable(),
});

export const CreateInventoryTransactionSchema = z.object({
  itemId: z.string().uuid(),
  type: z.enum(INVENTORY_TRANSACTION_TYPES),
  quantity: z.coerce.number(),
  sourceDocPath: z.string().max(500).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
});

export const ConfirmIntakeLineSchema = z.object({
  itemName: z.string().min(1, 'Item name is required'),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  unitCost: z.coerce.number().min(0).nullable().optional(),
  unit: z.enum(INVENTORY_UNITS),
  matchedItemId: z.string().uuid().nullable().optional(),
});

export const ConfirmIntakeLinesSchema = z.array(ConfirmIntakeLineSchema).min(1, 'Add at least one line item');

export type CreateInventoryItemInput = z.infer<typeof CreateInventoryItemSchema>;
export type CreateInventoryTransactionInput = z.infer<typeof CreateInventoryTransactionSchema>;
export type ConfirmIntakeLineInput = z.infer<typeof ConfirmIntakeLineSchema>;
