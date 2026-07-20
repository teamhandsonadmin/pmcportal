'use client';

import { useState, useTransition } from 'react';
import { bulkApplyChecklistStatus } from '@/app/actions/checklist-management';
import type { ChecklistManagementData, ChecklistCell } from '@/app/actions/checklist-management';
import { STATUS_CHIP, STATUS_ORDER } from '@/components/tasks/StatusDropdown';
import type { CompletionStatus, DependencyCategory } from '@/lib/types/tasks';
import { formatDate } from '@/lib/utils/format';

// Duplicated rather than shared, matching this codebase's established
// convention for this exact map (already independently defined in
// DependencyChecklist.tsx, DependencyProgress.tsx, GanttTaskBars.tsx, etc).
// 'quantity' deliberately omitted — this page's tabs are the six
// department/trade categories, not the newer Quantity tracking category.
const CATEGORY_LABEL: Record<Exclude<DependencyCategory, 'quantity'>, string> = {
  architect: 'Architect',
  client: 'Client',
  consultant: 'Consultant',
  contractor: 'Contractor',
  inspector: 'Inspector',
  procurement: 'Procurement',
};

function StatusBadge({ status }: { status: CompletionStatus }) {
  const chip = STATUS_CHIP[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ backgroundColor: chip.bg, color: chip.text }}
    >
      <span className="w-[6px] h-[6px] rounded-full flex-shrink-0" style={{ backgroundColor: chip.dot }} />
      {chip.label}
    </span>
  );
}

export function ChecklistManagementView({ data }: { data: ChecklistManagementData }) {
  const [activeCategory, setActiveCategory] = useState<DependencyCategory>(data.categories[0]?.category ?? 'architect');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkItemLabel, setBulkItemLabel] = useState<string>('');
  const [bulkStatus, setBulkStatus] = useState<CompletionStatus>('YES');
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Local overrides so applying a bulk action reflects immediately without
  // waiting for the server round-trip + revalidation to re-render this page
  // — cleared whenever the underlying `data` prop actually changes (a real
  // refresh), keyed the same way as data.cells.
  const [overrides, setOverrides] = useState<Record<string, CompletionStatus>>({});

  const column = data.categories.find((c) => c.category === activeCategory);
  const itemLabels = column?.itemLabels ?? [];

  function cellFor(taskId: string, itemLabel: string): { cell: ChecklistCell | undefined; status: CompletionStatus } {
    const key = `${taskId}::${activeCategory}::${itemLabel}`;
    const cell = data.cells[key];
    const status = overrides[key] ?? cell?.status ?? 'PENDING';
    return { cell, status };
  }

  const allSelected = data.tasks.length > 0 && data.tasks.every((t) => selected.has(t.id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(data.tasks.map((t) => t.id)));
  }

  function toggleOne(taskId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  function handleApply() {
    if (!bulkItemLabel || selected.size === 0) return;
    setError(null);
    setConfirmation(null);
    const taskIds = [...selected];
    startTransition(async () => {
      const res = await bulkApplyChecklistStatus({
        taskIds,
        category: activeCategory,
        itemLabel: bulkItemLabel,
        status: bulkStatus,
      });
      if (!res.success) {
        setError(typeof res.error === 'string' ? res.error : 'Failed to apply');
        return;
      }
      setOverrides((prev) => {
        const next = { ...prev };
        for (const taskId of taskIds) {
          next[`${taskId}::${activeCategory}::${bulkItemLabel}`] = bulkStatus;
        }
        return next;
      });
      setConfirmation(
        `Updated "${bulkItemLabel}" to "${STATUS_CHIP[bulkStatus].label}" on ${res.data!.updatedCount} task${res.data!.updatedCount === 1 ? '' : 's'}.`
      );
    });
  }

  const switchTab = (cat: DependencyCategory) => {
    setActiveCategory(cat);
    setBulkItemLabel('');
    setConfirmation(null);
    setError(null);
  };

  return (
    <div className="space-y-4">
      {/* Department tabs */}
      <div className="flex items-center gap-1.5 border-b border-gray-200">
        {data.categories.map(({ category, itemLabels: labels }) => (
          <button
            key={category}
            type="button"
            onClick={() => switchTab(category)}
            className="px-3 py-2 text-[13px] font-semibold border-b-2 transition-colors -mb-px"
            style={
              activeCategory === category
                ? { borderColor: 'var(--foreground)', color: 'var(--foreground)' }
                : { borderColor: 'transparent', color: 'var(--muted-foreground)' }
            }
          >
            {CATEGORY_LABEL[category as Exclude<DependencyCategory, 'quantity'>]}
            <span className="ml-1.5 text-[11px] font-normal text-gray-400">({labels.length})</span>
          </button>
        ))}
      </div>

      {itemLabels.length === 0 ? (
        <p className="text-[13px] text-muted-foreground py-6">
          No checklist items exist under {CATEGORY_LABEL[activeCategory as Exclude<DependencyCategory, 'quantity'>]} for these tasks.
        </p>
      ) : (
        <>
          {/* Bulk-apply control */}
          <div className="flex flex-wrap items-end gap-3 bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex flex-col gap-1">
              <label className="text-[11.5px] font-medium text-gray-500">Checklist item</label>
              <select
                value={bulkItemLabel}
                onChange={(e) => setBulkItemLabel(e.target.value)}
                className="h-9 min-w-[220px] rounded-lg border border-gray-200 px-2.5 text-[13px]"
              >
                <option value="">Select item…</option>
                {itemLabels.map((label) => (
                  <option key={label} value={label}>{label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11.5px] font-medium text-gray-500">Set status to</label>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value as CompletionStatus)}
                className="h-9 min-w-[150px] rounded-lg border border-gray-200 px-2.5 text-[13px]"
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>{STATUS_CHIP[s].label}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={!bulkItemLabel || selected.size === 0 || isPending}
              onClick={handleApply}
              className="h-9 px-4 rounded-lg bg-gray-900 text-white text-[13px] font-semibold hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPending ? 'Applying…' : `Apply to ${selected.size} selected`}
            </button>
          </div>

          {confirmation && (
            <div className="px-4 py-2.5 rounded-lg bg-green-50 border border-green-200 text-[13px] text-green-800 font-medium">
              {confirmation}
            </div>
          )}
          {error && (
            <div className="px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[13px] text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="min-w-full text-[12.5px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="w-10 px-3 py-2.5 text-left">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">Task</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">Planned</th>
                  {itemLabels.map((label) => (
                    <th key={label} className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.tasks.map((task) => (
                  <tr key={task.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
                    <td className="px-3 py-2.5">
                      <input type="checkbox" checked={selected.has(task.id)} onChange={() => toggleOne(task.id)} />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-gray-900">{task.taskId}</div>
                      <div className="text-[11.5px] text-gray-500 max-w-[260px] truncate">{task.taskName}</div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-gray-600">
                      {formatDate(task.plannedStartDate)} – {formatDate(task.dueDate)}
                    </td>
                    {itemLabels.map((label) => {
                      const { status } = cellFor(task.id, label);
                      return (
                        <td key={label} className="px-3 py-2.5">
                          <StatusBadge status={status} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
