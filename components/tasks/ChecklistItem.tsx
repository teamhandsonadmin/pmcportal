'use client';

import { useState, useTransition } from 'react';
import { updateDependencyCompletion } from '@/app/actions/dependencies';
import { createComment } from '@/app/actions/comments';
import { formatDate } from '@/lib/utils/format';
import { isItemDone } from '@/lib/types/tasks';
import type { DependencyItem, CompletionStatus } from '@/lib/types/tasks';
import { STATUS_CHIP, StatusDropdown } from './StatusDropdown';
import { InlineCommentThread, DefaultCommentBox } from './InlineCommentThread';

interface ChecklistItemProps {
  item: DependencyItem;
  taskId: string;
  locked: boolean;
}

// The inline "+ Note"/textarea affordance this used to have was replaced by
// the real threaded CommentThreadModal (see Comment model) — a single
// unstructured comment field per completion couldn't support replies,
// authorship, or timestamps. updateDependencyCompletion no longer takes a
// comment argument at all now that nothing writes DependencyCompletion.comment
// going forward.
export function ChecklistItem({ item, taskId, locked }: ChecklistItemProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [commentsOpen, setCommentsOpen] = useState(false);

  const currentStatus: CompletionStatus = item.completion?.status ?? 'PENDING';
  const cleared = isItemDone(currentStatus);
  const [commentCount, setCommentCount] = useState(item.commentCount ?? 0);
  const { Icon: CurrentStatusIcon } = STATUS_CHIP[currentStatus];

  async function quickAddComment(body: string) {
    const res = await createComment(item.id, body, null);
    if (res.success) setCommentCount((c) => c + 1);
  }

  function setStatus(status: CompletionStatus) {
    if (locked) return;
    setError(null);
    startTransition(async () => {
      const result = await updateDependencyCompletion(item.id, taskId, status);
      if (!result.success) {
        setError(typeof result.error === 'string' ? result.error : 'Failed to update');
      }
    });
  }

  return (
    <div className={`py-3 border-b border-border last:border-0 transition-opacity ${isPending ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">

        <div className="flex-shrink-0 mt-0.5">
          {locked ? (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold"
              style={{ backgroundColor: STATUS_CHIP[currentStatus].bg, color: STATUS_CHIP[currentStatus].text }}
            >
              <CurrentStatusIcon size={14} strokeWidth={2.25} className="flex-shrink-0" />
              {STATUS_CHIP[currentStatus].label}
            </span>
          ) : (
            <StatusDropdown status={currentStatus} disabled={locked || isPending} onChange={setStatus} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium select-none flex-shrink-0 ${cleared ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              {item.itemLabel}
            </span>

            {/* Fills the row's own empty space, same line as the label — not
                a new block below it. Stays available even after commenting
                (so a 2nd, 3rd... comment doesn't require opening the full
                thread). The comment count lives only on the icon to the
                right — no duplicate indicator here. */}
            {!commentsOpen && (
              <div className="flex-1 min-w-0 max-w-md">
                <DefaultCommentBox onSend={quickAddComment} />
              </div>
            )}
          </div>

          {currentStatus === 'YES' && item.completion?.completedAt && (
            <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
              Delivered · {formatDate(item.completion.completedAt)}
            </p>
          )}

          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>

        <button
          onClick={() => setCommentsOpen((v) => !v)}
          className="flex items-center gap-1 h-7 px-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-gray-100 transition-colors text-[12px] font-medium flex-shrink-0"
          title="Comments"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
          </svg>
          {commentCount > 0 && <span>{commentCount}</span>}
        </button>
      </div>

      {commentsOpen && (
        <InlineCommentThread dependencyItemId={item.id} onClose={() => setCommentsOpen(false)} />
      )}
    </div>
  );
}
