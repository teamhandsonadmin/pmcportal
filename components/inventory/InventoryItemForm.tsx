'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createInventoryItem } from '@/app/actions/inventory';
import { INVENTORY_UNITS } from '@/lib/validations/inventory';
import type { ActionResult } from '@/lib/types/tasks';

const initialState: ActionResult<{ itemId: string }> = { success: true };

interface ProjectOption {
  id: string;
  name: string;
}

interface InventoryItemFormProps {
  projects: ProjectOption[];
}

export function InventoryItemForm({ projects }: InventoryItemFormProps) {
  const [state, formAction, isPending] = useActionState(createInventoryItem, initialState);

  const errors = (!state.success && typeof state.error === 'object') ? state.error : {};
  const globalError = !state.success && typeof state.error === 'string' ? state.error : null;

  return (
    <form action={formAction} className="space-y-5">
      {globalError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-[13px] text-red-600">
          {globalError}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="name">Item Name</Label>
        <Input id="name" name="name" placeholder="e.g. Cement Bags" required />
        {errors.name && <p className="text-xs text-red-500">{errors.name[0]}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="sku">
            SKU <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input id="sku" name="sku" placeholder="e.g. SKU-004" />
          {errors.sku && <p className="text-xs text-red-500">{errors.sku[0]}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="category">
            Category <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input id="category" name="category" placeholder="e.g. Construction Material" />
          {errors.category && <p className="text-xs text-red-500">{errors.category[0]}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="unit">Unit</Label>
        <select
          id="unit"
          name="unit"
          defaultValue="PCS"
          className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        >
          {INVENTORY_UNITS.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
        {errors.unit && <p className="text-xs text-red-500">{errors.unit[0]}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="reorderLevel">
            Reorder Level <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input id="reorderLevel" name="reorderLevel" type="number" step="0.01" min="0" placeholder="e.g. 50" />
          {errors.reorderLevel && <p className="text-xs text-red-500">{errors.reorderLevel[0]}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unitCost">
            Unit Cost (₹) <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input id="unitCost" name="unitCost" type="number" step="0.01" min="0" placeholder="e.g. 350" />
          {errors.unitCost && <p className="text-xs text-red-500">{errors.unitCost[0]}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="supplier">
          Supplier <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input id="supplier" name="supplier" placeholder="e.g. ABC Building Materials" />
        {errors.supplier && <p className="text-xs text-red-500">{errors.supplier[0]}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="projectId">
          Linked Project <span className="text-muted-foreground">(optional)</span>
        </Label>
        <select
          id="projectId"
          name="projectId"
          defaultValue=""
          className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        >
          <option value="">Unassigned</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {errors.projectId && <p className="text-xs text-red-500">{errors.projectId[0]}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">
          Notes <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea id="notes" name="notes" rows={3} className="resize-none" />
        {errors.notes && <p className="text-xs text-red-500">{errors.notes[0]}</p>}
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Creating…' : 'Create Item'}
        </Button>
        <Button type="button" variant="outline" onClick={() => history.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
