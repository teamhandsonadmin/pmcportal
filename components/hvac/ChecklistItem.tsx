'use client';

import { useState, useTransition } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { updateDependencyCompletion } from '@/app/actions/dependencies';
import { formatDate } from '@/lib/utils/format';
import type { DependencyItem, CompletionStatus } from '@/lib/types/hvac';

interface ChecklistItemProps {
  item: DependencyItem;
  taskId: string;
  locked: boolean;
}

const STATUS_CONFIG: Record<CompletionStatus, { label: string; color: string; bg: string; icon: string }> = {
  pending:      { label: 'Pending',      color: '#92400E', bg: '#FEF3C7', icon: '○' },
  delivered:    { label: 'Delivered',    color: '#15803D', bg: '#DCFCE7', icon: '✓' },
  not_required: { label: 'Not Required', color: '#6B7280', bg: '#F3F4F6', icon: '—' },
};

const STATUS_ORDER: CompletionStatus[] = ['pending', 'delivered', 'not_required'];

export function ChecklistItem({ item, taskId, locked }: ChecklistItemProps) {
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState(item.completion?.comment ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentStatus: CompletionStatus = item.completion?.status ?? 'pending';
  const cfg = STATUS_CONFIG[currentStatus];

  function setStatus(status: CompletionStatus) {
    if (locked) return;
    setError(null);
    startTransition(async () => {
      const result = await updateDependencyCompletion(item.id, taskId, status, comment || null);
      if (!result.success) {
        setError(typeof result.error === 'string' ? result.error : 'Failed to update');
      }
    });
  }

  function saveComment() {
    startTransition(async () => {
      const result = await updateDependencyCompletion(item.id, taskId, currentStatus, comment || null);
      if (!result.success) {
        setError(typeof result.error === 'string' ? result.error : 'Failed to save');
      } else {
        setShowComment(false);
      }
    });
  }

  return (
    <div className={`py-3 border-b border-border last:border-0 transition-opacity ${isPending ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">

        {/* Status cycle button */}
        <button
          onClick={() => {
            const idx = STATUS_ORDER.indexOf(currentStatus);
            const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
            setStatus(next);
          }}
          disabled={locked || isPending}
          className="flex-shrink-0 w-6 h-6 mt-0.5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-all"
          style={{
            borderColor: cfg.color,
            backgroundColor: cfg.bg,
            color: cfg.color,
          }}
          title={`Current: ${cfg.label} — click to change`}
        >
          {cfg.icon}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-medium select-none ${
              currentStatus === 'delivered' ? 'line-through text-muted-foreground' :
              currentStatus === 'not_required' ? 'text-muted-foreground/60 line-through' :
              'text-foreground'
            }`}>
              {item.itemLabel}
            </span>

            {/* Status badge */}
            {!locked && (
              <div className="flex gap-1 ml-auto">
                {STATUS_ORDER.map((s) => {
                  const c = STATUS_CONFIG[s];
                  const active = currentStatus === s;
                  return (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      disabled={locked || isPending}
                      className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full border transition-all"
                      style={{
                        backgroundColor: active ? c.bg : 'transparent',
                        color: active ? c.color : '#9CA3AF',
                        borderColor: active ? c.color : '#E5E7EB',
                      }}
                    >
                      {c.icon} {c.label}
                    </button>
                  );
                })}
              </div>
            )}

            {locked && (
              <span
                className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full ml-auto"
                style={{ backgroundColor: cfg.bg, color: cfg.color }}
              >
                {cfg.icon} {cfg.label}
              </span>
            )}
          </div>

          {currentStatus === 'delivered' && item.completion?.completedAt && (
            <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
              Delivered · {formatDate(item.completion.completedAt)}
            </p>
          )}

          {item.completion?.comment && !showComment && (
            <p className="text-xs text-muted-foreground mt-1 italic">
              &ldquo;{item.completion.comment}&rdquo;
            </p>
          )}

          {showComment && (
            <div className="mt-2 space-y-2">
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a note…"
                rows={2}
                className="text-sm resize-none"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={saveComment} disabled={isPending}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowComment(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>

        {!locked && !showComment && (
          <button
            onClick={() => setShowComment(true)}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 mt-0.5"
          >
            {item.completion?.comment ? 'Edit note' : '+ Note'}
          </button>
        )}
      </div>
    </div>
  );
}
