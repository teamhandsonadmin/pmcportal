'use client';

import { useState, useTransition } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { updateDependencyCompletion } from '@/app/actions/dependencies';
import { formatDate } from '@/lib/utils/format';
import { isItemDone } from '@/lib/types/hvac';
import type { DependencyItem, CompletionStatus } from '@/lib/types/hvac';
import { NOTE_PROMPT_STATUSES, STATUS_CHIP, StatusDropdown } from './StatusDropdown';

interface ChecklistItemProps {
  item: DependencyItem;
  taskId: string;
  locked: boolean;
}

export function ChecklistItem({ item, taskId, locked }: ChecklistItemProps) {
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState(item.completion?.comment ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentStatus: CompletionStatus = item.completion?.status ?? 'PENDING';
  const cleared = isItemDone(currentStatus);

  function setStatus(status: CompletionStatus) {
    if (locked) return;
    setError(null);
    if (NOTE_PROMPT_STATUSES.includes(status)) setShowComment(true);
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

        <div className="flex-shrink-0 mt-0.5">
          {locked ? (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
              style={{ backgroundColor: STATUS_CHIP[currentStatus].bg, color: STATUS_CHIP[currentStatus].text }}
            >
              <span className="w-[6px] h-[6px] rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_CHIP[currentStatus].dot }} />
              {STATUS_CHIP[currentStatus].label}
            </span>
          ) : (
            <StatusDropdown status={currentStatus} disabled={locked || isPending} onChange={setStatus} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-medium select-none ${cleared ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              {item.itemLabel}
            </span>
          </div>

          {currentStatus === 'YES' && item.completion?.completedAt && (
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
                placeholder={NOTE_PROMPT_STATUSES.includes(currentStatus) ? 'Add a note on why (optional but recommended)…' : 'Add a note…'}
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
