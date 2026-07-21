'use client';

import { XIcon } from 'lucide-react';
import { useCommentThread, CommentRow, CommentInput, CATEGORY_LABELS } from './CommentThreadModal';

interface InlineCommentThreadProps {
  dependencyItemId: string;
  onClose: () => void;
}

// Opens INSIDE the checklist row itself (not a page-level dialog — see
// CommentThreadModal for that, still used by the aggregated Comments page).
// The parent row conditionally mounts this when its comment icon is
// clicked, so unlike CommentThreadModal there's no "closed" (null id) state
// to represent — mounted means open.
export function InlineCommentThread({ dependencyItemId, onClose }: InlineCommentThreadProps) {
  const { thread, loading, handleReply, handleNewComment } = useCommentThread(dependencyItemId);

  return (
    <div className="mt-2.5 mb-1 w-full max-w-lg mx-auto rounded-xl border border-gray-200 bg-gray-50 overflow-hidden shadow-sm">
      <div className="flex items-start justify-between gap-3 px-4 py-2.5 border-b border-gray-200 bg-white">
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold text-gray-900">Comments</p>
          {thread && (
            <p className="text-[11px] text-gray-400 truncate">
              {CATEGORY_LABELS[thread.context.category]} · {thread.context.itemLabel}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
          title="Close"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      <div className="max-h-72 overflow-y-auto px-4 py-3">
        {loading ? (
          <p className="text-[12px] text-gray-400 text-center py-6">Loading…</p>
        ) : !thread || thread.comments.length === 0 ? (
          <p className="text-[12px] text-gray-400 text-center py-6">No comments yet — start the conversation below.</p>
        ) : (
          <div className="space-y-4">
            {thread.comments.map((c) => (
              <CommentRow key={c.id} comment={c} isReply={false} onReply={handleReply} />
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-gray-200 bg-white">
        <CommentInput placeholder="Enter your comment…" onSend={handleNewComment} autoFocus />
      </div>
    </div>
  );
}

// Sits INLINE in the row itself, next to the item's own label — not a new
// block below it — filling the row's own empty space. Shown only while the
// item has zero comments (see the parent row: once count > 0, a "N
// comments" link takes over this same spot instead). No margin/centering of
// its own — the parent controls sizing via its own wrapper.
export function DefaultCommentBox({ onSend }: { onSend: (body: string) => Promise<void> }) {
  return <CommentInput placeholder="Add comments…" onSend={onSend} />;
}
