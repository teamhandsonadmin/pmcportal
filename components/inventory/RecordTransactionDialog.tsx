'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { createInventoryTransaction } from '@/app/actions/inventory';
import { INVENTORY_TRANSACTION_TYPES } from '@/lib/validations/inventory';
import type { ActionResult } from '@/lib/types/tasks';

const initialState: ActionResult = { success: true };

const TYPE_LABEL: Record<string, string> = {
  IN: 'Stock In',
  OUT: 'Stock Out',
  ADJUSTMENT: 'Adjustment (set absolute quantity)',
};

export function RecordTransactionDialog({ itemId }: { itemId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createInventoryTransaction, initialState);
  const [lastHandledState, setLastHandledState] = useState(state);

  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state.success && open) setOpen(false);
  }

  const errors = (!state.success && typeof state.error === 'object') ? state.error : {};
  const globalError = !state.success && typeof state.error === 'string' ? state.error : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" onClick={() => setOpen(true)}>Record Transaction</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Transaction</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4 mt-2">
          <input type="hidden" name="itemId" value={itemId} />

          {globalError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-[13px] text-red-600">
              {globalError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="type">Transaction Type</Label>
            <select
              id="type"
              name="type"
              defaultValue="IN"
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
              {INVENTORY_TRANSACTION_TYPES.map((t) => (
                <option key={t} value={t}>{TYPE_LABEL[t]}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="quantity">Quantity</Label>
            <Input id="quantity" name="quantity" type="number" step="0.01" min="0" required />
            {errors.quantity && <p className="text-xs text-red-500">{errors.quantity[0]}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">
              Note <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea id="note" name="note" rows={2} className="resize-none" />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save Transaction'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
