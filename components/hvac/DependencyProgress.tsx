import type { CategoryProgress, DependencyCategory } from '@/lib/types/hvac';
import { CATEGORY_COLORS } from '@/lib/types/hvac';

const CATEGORY_LABELS: Record<DependencyCategory, string> = {
  architect:  'Architect',
  client:     'Client',
  consultant: 'Consultant',
  contractor: 'Contractor',
  inspector:  'Inspector',
};

interface DependencyProgressProps {
  progress: CategoryProgress[];
}

export function DependencyProgress({ progress }: DependencyProgressProps) {
  return (
    <div className="space-y-3">
      {(['architect', 'client', 'consultant', 'contractor', 'inspector'] as DependencyCategory[]).map((cat) => {
        const data = progress.find((p) => p.category === cat);
        const pct = data?.completionPct ?? 0;
        const done = data?.completedItems ?? 0;
        const total = data?.totalItems ?? 0;
        const colors = CATEGORY_COLORS[cat];

        return (
          <div key={cat}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.dot }} />
                <span className="text-xs font-semibold text-foreground">{CATEGORY_LABELS[cat]}</span>
              </div>
              <span className="text-xs font-mono text-muted-foreground">{done}/{total}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${pct}%`,
                  backgroundColor: pct === 100 ? '#22C55E' : colors.dot,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function OverallProgress({ progress }: DependencyProgressProps) {
  const overall = progress.length
    ? Math.round(progress.reduce((a, p) => a + p.completionPct, 0) / progress.length)
    : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-16 h-16 flex-shrink-0">
        <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor"
            className="text-muted" strokeWidth="2.5" />
          <circle cx="18" cy="18" r="15.9" fill="none"
            stroke={overall === 100 ? '#22C55E' : '#4f46e5'}
            className="transition-all duration-500"
            strokeWidth="2.5"
            strokeDasharray={`${overall} 100`}
            strokeLinecap="round" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold font-mono">
          {overall}%
        </span>
      </div>
      <div>
        <p className="text-sm font-semibold">Overall Progress</p>
        <p className="text-xs text-muted-foreground">
          {progress.filter((p) => p.categoryComplete).length} of 4 categories complete
        </p>
      </div>
    </div>
  );
}
