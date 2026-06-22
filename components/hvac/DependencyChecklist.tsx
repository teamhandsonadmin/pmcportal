import { ChecklistItem } from './ChecklistItem';
import type { DependencyItem, DependencyCategory } from '@/lib/types/hvac';
import { CATEGORY_COLORS } from '@/lib/types/hvac';
import { isItemDone } from '@/lib/types/hvac';

const CATEGORY_LABELS: Record<DependencyCategory, string> = {
  architect:  'Architect',
  client:     'Client',
  consultant: 'Consultant',
  contractor: 'Contractor',
  inspector:  'Inspector',
};

const CATEGORY_ICONS: Record<DependencyCategory, string> = {
  architect:  '◈',
  client:     '◉',
  consultant: '◎',
  contractor: '⬡',
  inspector:  '◷',
};

interface DependencyChecklistProps {
  taskId: string;
  category: DependencyCategory;
  items: DependencyItem[];
  locked: boolean;
}

export function DependencyChecklist({ taskId, category, items, locked }: DependencyChecklistProps) {
  const completedCount = items.filter((i) => isItemDone(i.completion?.status)).length;
  const total = items.length;
  const allDone = completedCount === total && total > 0;
  const colors = CATEGORY_COLORS[category];

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: `1.5px solid ${allDone ? '#22C55E' : colors.border}` }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex items-center justify-between"
        style={{
          backgroundColor: allDone ? '#F0FDF4' : colors.bg,
          borderBottomColor: allDone ? '#86EFAC' : colors.badge,
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-base" style={{ color: allDone ? '#16A34A' : colors.dot }}>
            {CATEGORY_ICONS[category]}
          </span>
          <h3
            className="text-[12.5px] font-bold uppercase tracking-widest"
            style={{ color: allDone ? '#15803D' : colors.text }}
          >
            {CATEGORY_LABELS[category]}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {allDone && (
            <span className="text-[10.5px] font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
              ✓ Complete
            </span>
          )}
          <span
            className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded"
            style={{
              color: allDone ? '#15803D' : colors.text,
              backgroundColor: allDone ? '#DCFCE7' : colors.badge,
            }}
          >
            {completedCount}/{total}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1" style={{ backgroundColor: colors.badge }}>
        <div
          className="h-full transition-all duration-500"
          style={{
            width: total > 0 ? `${Math.round((completedCount / total) * 100)}%` : '0%',
            backgroundColor: allDone ? '#22C55E' : colors.dot,
          }}
        />
      </div>

      {/* Items */}
      <div className="px-4">
        {items.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No items in this category.</p>
        ) : (
          items
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((item) => (
              <ChecklistItem key={item.id} item={item} taskId={taskId} locked={locked} />
            ))
        )}
      </div>
    </div>
  );
}
