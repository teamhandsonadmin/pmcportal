'use client';

import { useEffect, useRef, useState } from 'react';
import { Ruler } from 'lucide-react';
import { updateDependencyItemQuantity } from '@/app/actions/dependencies';
import { QUANTITY_UNIT_LABEL, QUANTITY_UNIT_ORDER } from '@/lib/types/tasks';
import type { QuantityUnit } from '@/lib/types/tasks';

interface QuantityControlProps {
  itemId: string;
  taskId: string;
  quantityUnit: QuantityUnit | null | undefined;
  quantityValue: number | null | undefined;
  disabled: boolean;
  // Pending/Excess Quantity are derived from Targeted/Done elsewhere on the
  // same task — not editable here, just displayed.
  readOnly?: boolean;
}

export function QuantityControl({ itemId, taskId, quantityUnit, quantityValue, disabled, readOnly }: QuantityControlProps) {
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState<QuantityUnit>(quantityUnit ?? QUANTITY_UNIT_ORDER[0]);
  const [value, setValue] = useState<string>(quantityValue != null ? String(quantityValue) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<{ unit: QuantityUnit; value: number } | null>(
    quantityUnit && quantityValue != null ? { unit: quantityUnit, value: quantityValue } : null
  );
  const ref = useRef<HTMLDivElement>(null);

  // Read-only items (Pending/Excess) are recalculated by SOMEONE ELSE's save
  // (editing Targeted/Done Quantity) — this component's own `current` state
  // has to re-sync from fresh server props rather than only ever reflecting
  // its own save, since it never triggers one itself.
  useEffect(() => {
    if (!readOnly) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrent(quantityUnit && quantityValue != null ? { unit: quantityUnit, value: quantityValue } : null);
  }, [readOnly, quantityUnit, quantityValue]);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  function openEditor() {
    if (disabled || readOnly) return;
    setUnit(current?.unit ?? QUANTITY_UNIT_ORDER[0]);
    setValue(current ? String(current.value) : '');
    setError(null);
    setOpen(true);
  }

  async function save() {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Enter a positive number');
      return;
    }
    setSaving(true);
    setError(null);
    const result = await updateDependencyItemQuantity(itemId, taskId, unit, parsed);
    setSaving(false);
    if (!result.success) {
      setError(typeof result.error === 'string' ? result.error : 'Failed to save');
      return;
    }
    setCurrent({ unit, value: parsed });
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={openEditor}
        disabled={disabled}
        title={readOnly ? 'Calculated automatically from Targeted / Quantity Of Work Done' : 'Quantity of work'}
        className={`flex items-center gap-1 h-5 px-1.5 rounded text-[10px] disabled:opacity-60 ${
          readOnly
            ? 'text-gray-500 bg-gray-50 cursor-default'
            : `transition-colors ${current ? 'text-gray-700 bg-gray-100 hover:bg-gray-200' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`
        }`}
      >
        <Ruler size={11} strokeWidth={2.25} className="flex-shrink-0" />
        {current ? `${current.value} ${QUANTITY_UNIT_LABEL[current.unit]}` : 'Not set'}
        {readOnly && <span className="italic text-gray-400">(auto)</span>}
      </button>

      {!readOnly && open && (
        <div className="absolute z-20 top-full right-0 mt-1 w-56 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Quantity of work</p>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as QuantityUnit)}
            className="w-full text-[12.5px] text-gray-800 border border-gray-200 rounded-md px-2 py-1.5 mb-2 outline-none focus:border-gray-400 bg-white"
          >
            {QUANTITY_UNIT_ORDER.map((u) => (
              <option key={u} value={u}>{QUANTITY_UNIT_LABEL[u]}</option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            step="any"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter value"
            autoFocus
            className="w-full text-[12.5px] text-gray-800 border border-gray-200 rounded-md px-2 py-1.5 mb-2 outline-none focus:border-gray-400"
          />
          {error && <p className="text-[11px] text-red-500 mb-2">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setOpen(false)} className="text-[11px] text-gray-400 hover:text-gray-700">Cancel</button>
            <button
              onClick={save}
              disabled={saving}
              className="px-2.5 py-1 rounded-md bg-gray-900 text-white text-[11px] font-semibold hover:bg-black transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
