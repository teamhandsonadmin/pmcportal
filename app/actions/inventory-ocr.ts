'use server';

import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ensureInventoryDocumentsBucket, uploadInventoryDocument } from '@/lib/supabase/admin';
import { extractInvoiceData, type ExtractedInvoiceLine } from '@/lib/ocr/extractInvoiceData';
import { ConfirmIntakeLinesSchema } from '@/lib/validations/inventory';
import type { ActionResult } from '@/lib/types/tasks';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png'];

export interface UploadExtractResult {
  lines: ExtractedInvoiceLine[];
  supplierGuess?: string;
  dateGuess?: string;
  sourceDocPath: string;
}

export async function uploadAndExtractInvoice(
  _prevState: ActionResult<UploadExtractResult>,
  formData: FormData
): Promise<ActionResult<UploadExtractResult>> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: 'Please choose a file to upload.' };
  }

  if (file.type === 'application/pdf') {
    return {
      success: false,
      error: "PDF invoices aren't supported yet — please upload a photo or screenshot (JPG/PNG) instead.",
    };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { success: false, error: 'Unsupported file type. Please upload a JPG or PNG image.' };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { success: false, error: 'File is too large. Maximum size is 10MB.' };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.type === 'image/png' ? 'png' : 'jpg';
  const path = `invoices/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${ext}`;

  try {
    await ensureInventoryDocumentsBucket();
    await uploadInventoryDocument(path, buffer, file.type);
  } catch {
    return { success: false, error: 'Failed to upload file. Please try again.' };
  }

  let extracted;
  try {
    extracted = await extractInvoiceData(buffer);
  } catch {
    return { success: false, error: 'Upload succeeded but OCR failed. You can still create items manually.' };
  }

  return {
    success: true,
    data: {
      lines: extracted.lines,
      supplierGuess: extracted.supplierGuess,
      dateGuess: extracted.dateGuess,
      sourceDocPath: path,
    },
  };
}

export async function confirmInventoryIntake(
  _prevState: ActionResult<{ created: number }>,
  formData: FormData
): Promise<ActionResult<{ created: number }>> {
  const sourceDocPath = formData.get('sourceDocPath') as string | null;
  const linesJson = formData.get('linesJson') as string | null;

  if (!linesJson) {
    return { success: false, error: 'No line items to confirm.' };
  }

  let rawLines: unknown;
  try {
    rawLines = JSON.parse(linesJson);
  } catch {
    return { success: false, error: 'Invalid line item data.' };
  }

  const parsed = ConfirmIntakeLinesSchema.safeParse(rawLines);
  if (!parsed.success) {
    return { success: false, error: 'Please review the line items — some fields are invalid.' };
  }

  const lines = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      for (const line of lines) {
        let itemId = line.matchedItemId ?? null;

        if (!itemId) {
          const created = await tx.inventoryItem.create({
            data: {
              name: line.itemName,
              unit: line.unit,
              unitCost: line.unitCost ?? null,
              quantityOnHand: 0,
            },
            select: { id: true },
          });
          itemId = created.id;
        }

        const item = await tx.inventoryItem.findUniqueOrThrow({
          where: { id: itemId },
          select: { quantityOnHand: true },
        });
        const newQty = Number(item.quantityOnHand) + line.quantity;

        await tx.inventoryTransaction.create({
          data: {
            itemId,
            type: 'IN',
            quantity: line.quantity,
            sourceDocPath: sourceDocPath || null,
            note: 'Created via OCR invoice intake',
          },
        });
        await tx.inventoryItem.update({ where: { id: itemId }, data: { quantityOnHand: newQty } });
      }
    });
  } catch {
    return { success: false, error: 'Failed to save inventory intake. Please try again.' };
  }

  await prisma.activityLog.create({
    data: {
      actionType: 'inventory_ocr_intake',
      payload: { itemCount: lines.length, sourceDocPath },
    },
  }).catch(() => {});

  revalidatePath('/inventory');
  redirect('/inventory');
}
