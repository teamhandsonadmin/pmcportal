'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { uploadAndExtractInvoice, confirmInventoryIntake } from '@/app/actions/inventory-ocr';
import { INVENTORY_UNITS } from '@/lib/validations/inventory';
import type { ActionResult } from '@/lib/types/tasks';
import type { UploadExtractResult } from '@/app/actions/inventory-ocr';

interface ExistingItem {
  id: string;
  name: string;
  sku: string | null;
}

interface EditableLine {
  itemName: string;
  quantity: number;
  unitCost: number | null;
  unit: string;
  matchedItemId: string | null;
}

const uploadInitial: ActionResult<UploadExtractResult> = { success: true };
const confirmInitial: ActionResult<{ created: number }> = { success: true };

function findMatch(name: string, existingItems: ExistingItem[]): string | null {
  const lower = name.trim().toLowerCase();
  if (!lower) return null;
  const exact = existingItems.find((i) => i.name.toLowerCase() === lower);
  if (exact) return exact.id;
  const partial = existingItems.find(
    (i) => i.name.toLowerCase().includes(lower) || lower.includes(i.name.toLowerCase())
  );
  return partial?.id ?? null;
}

export function InvoiceUploadFlow({ existingItems }: { existingItems: ExistingItem[] }) {
  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [uploadState, uploadAction, isUploading] = useActionState(uploadAndExtractInvoice, uploadInitial);
  const [confirmState, confirmAction, isConfirming] = useActionState(confirmInventoryIntake, confirmInitial);
  const [sourceDocPath, setSourceDocPath] = useState('');
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [lastHandledUploadState, setLastHandledUploadState] = useState(uploadState);

  if (uploadState !== lastHandledUploadState) {
    setLastHandledUploadState(uploadState);
    if (uploadState.success && uploadState.data) {
      const { lines: extracted, sourceDocPath: path } = uploadState.data;
      setSourceDocPath(path);
      setLines(
        extracted.map((l) => {
          const name = l.itemNameGuess ?? l.rawText;
          return {
            itemName: name,
            quantity: l.quantityGuess ?? 1,
            unitCost: l.unitCostGuess ?? null,
            unit: (l.unitGuess && INVENTORY_UNITS.includes(l.unitGuess.toUpperCase() as never)
              ? l.unitGuess.toUpperCase()
              : 'PCS') as string,
            matchedItemId: findMatch(name, existingItems),
          };
        })
      );
      setStep('review');
    }
  }

  const uploadError = !uploadState.success && typeof uploadState.error === 'string' ? uploadState.error : null;
  const confirmError = !confirmState.success && typeof confirmState.error === 'string' ? confirmState.error : null;

  function updateLine(idx: number, patch: Partial<EditableLine>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  if (step === 'upload') {
    return (
      <div className="bg-card border border-border rounded-xl p-6 card-shadow">
        <form action={uploadAction} className="space-y-4">
          {uploadError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-[13px] text-red-600">
              {uploadError}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="file">Invoice photo or screenshot</Label>
            <input
              id="file"
              name="file"
              type="file"
              accept="image/jpeg,image/png"
              required
              className="block w-full text-[13px] text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-[13px] file:font-medium file:bg-foreground file:text-background hover:file:opacity-85 file:cursor-pointer"
            />
            <p className="text-xs text-muted-foreground">
              JPG or PNG only, up to 10MB. PDF isn&apos;t supported yet.
            </p>
          </div>
          <Button type="submit" disabled={isUploading}>
            {isUploading ? 'Uploading & reading…' : 'Upload & Extract'}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-[13px] text-amber-800">
        OCR-extracted values are low-confidence guesses. Review and correct every field before confirming.
      </div>

      {confirmError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-[13px] text-red-600">
          {confirmError}
        </div>
      )}

      <form action={confirmAction} className="space-y-4">
        <input type="hidden" name="sourceDocPath" value={sourceDocPath} />
        <input type="hidden" name="linesJson" value={JSON.stringify(lines)} />

        <div className="bg-card border border-border rounded-xl overflow-hidden card-shadow">
          <div
            className="grid px-4 py-2.5 bg-muted/50 border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
            style={{ gridTemplateColumns: '2fr 90px 90px 100px 1.6fr 32px' }}
          >
            <span>Item Name</span>
            <span>Qty</span>
            <span>Unit</span>
            <span>Cost</span>
            <span>Match</span>
            <span />
          </div>
          <div className="divide-y divide-border">
            {lines.map((line, idx) => (
              <div
                key={idx}
                className="grid items-center gap-2 px-4 py-2.5"
                style={{ gridTemplateColumns: '2fr 90px 90px 100px 1.6fr 32px' }}
              >
                <Input
                  value={line.itemName}
                  onChange={(e) => updateLine(idx, { itemName: e.target.value, matchedItemId: null })}
                  className="h-8 text-[12.5px]"
                />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={line.quantity}
                  onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
                  className="h-8 text-[12.5px]"
                />
                <select
                  value={line.unit}
                  onChange={(e) => updateLine(idx, { unit: e.target.value })}
                  className="h-8 rounded-md border border-input bg-transparent px-2 text-[12.5px]"
                >
                  {INVENTORY_UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={line.unitCost ?? ''}
                  onChange={(e) => updateLine(idx, { unitCost: e.target.value ? Number(e.target.value) : null })}
                  className="h-8 text-[12.5px]"
                />
                <select
                  value={line.matchedItemId ?? ''}
                  onChange={(e) => updateLine(idx, { matchedItemId: e.target.value || null })}
                  className="h-8 rounded-md border border-input bg-transparent px-2 text-[12px]"
                >
                  <option value="">— Create new item —</option>
                  {existingItems.map((i) => (
                    <option key={i.id} value={i.id}>Matches: {i.name}{i.sku ? ` (${i.sku})` : ''}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeLine(idx)}
                  className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-red-500 rounded hover:bg-red-50 transition-colors"
                  aria-label="Remove line"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
            {lines.length === 0 && (
              <p className="text-[12.5px] text-muted-foreground text-center py-6">
                No lines detected — go back and try a clearer photo, or cancel and add items manually.
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={isConfirming || lines.length === 0}>
            {isConfirming ? 'Saving…' : `Confirm ${lines.length} Item${lines.length === 1 ? '' : 's'}`}
          </Button>
          <Button type="button" variant="outline" onClick={() => setStep('upload')}>
            Start Over
          </Button>
        </div>
      </form>
    </div>
  );
}
