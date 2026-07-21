'use client';

import { useEffect, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import EmojiPicker, { type EmojiClickData } from 'emoji-picker-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { fetchCommentThread, createComment } from '@/app/actions/comments';
import type { CommentThread, ThreadComment } from '@/lib/data/comment-thread';

export const CATEGORY_LABELS: Record<string, string> = {
  architect: 'Architect',
  client: 'Client',
  consultant: 'Consultant',
  contractor: 'Contractor',
  procurement: 'Procurement',
};

function initialOf(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0].toUpperCase() : '?';
}

export function Avatar({ name }: { name: string }) {
  return (
    <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0">
      {initialOf(name)}
    </div>
  );
}

// Shared by the reply box and the bottom new-comment box — a single
// text input + emoji-picker toggle + Send button. Reactions (a separate
// per-comment emoji-response feature) were deliberately scoped OUT here —
// see this component's usage notes — this is just the input's own emoji
// picker, inserted into whatever's currently typed.
export function CommentInput({
  placeholder,
  onSend,
  autoFocus,
}: {
  placeholder: string;
  onSend: (body: string) => Promise<void>;
  autoFocus?: boolean;
}) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleSend() {
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      await onSend(body);
      setBody('');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="flex-1 bg-transparent text-[13px] text-gray-800 placeholder-gray-400 outline-none min-w-0"
        />
        <div className="relative flex-shrink-0" ref={pickerRef}>
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            className="text-gray-400 hover:text-gray-700 transition-colors"
            title="Add emoji"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
            </svg>
          </button>
          {pickerOpen && (
            <div className="absolute bottom-full right-0 mb-2 z-50 shadow-lg rounded-xl overflow-hidden">
              <EmojiPicker
                onEmojiClick={(data: EmojiClickData) => { setBody((b) => b + data.emoji); setPickerOpen(false); }}
                width={280}
                height={330}
              />
            </div>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={handleSend}
        disabled={!body.trim() || sending}
        className="px-3.5 py-2 rounded-xl bg-gray-900 text-white text-[12.5px] font-semibold hover:bg-black transition-colors disabled:opacity-40 flex-shrink-0"
      >
        {sending ? 'Sending…' : 'Send'}
      </button>
    </div>
  );
}

export function CommentRow({
  comment,
  isReply,
  onReply,
}: {
  comment: ThreadComment;
  isReply: boolean;
  onReply: (parentId: string, body: string) => Promise<void>;
}) {
  const [replying, setReplying] = useState(false);

  async function handleReply(body: string) {
    await onReply(comment.id, body);
    setReplying(false);
  }

  return (
    <div className={isReply ? 'pl-11 mt-3 border-l-2 border-gray-100' : ''}>
      <div className={isReply ? 'pl-3' : ''}>
        <div className="flex items-start gap-2.5">
          <Avatar name={comment.authorName} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-gray-900">{comment.authorName}</span>
              <span className="text-[11px] text-gray-400">
                {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
              </span>
            </div>
            <p className="text-[13px] text-gray-700 mt-0.5 leading-relaxed whitespace-pre-wrap">{comment.body}</p>
            {!isReply && (
              <button
                type="button"
                onClick={() => setReplying((r) => !r)}
                className="text-[11.5px] font-semibold text-gray-500 hover:text-gray-900 mt-1.5 uppercase tracking-wide"
              >
                Reply
              </button>
            )}
          </div>
        </div>

        {replying && (
          <div className="mt-2.5 ml-[42px]">
            <CommentInput placeholder="Write a reply…" onSend={handleReply} autoFocus />
          </div>
        )}

        {comment.replies.map((reply) => (
          <CommentRow key={reply.id} comment={reply} isReply onReply={onReply} />
        ))}
      </div>
    </div>
  );
}

// Shared by CommentThreadModal (page-level dialog, used by the aggregated
// Comments page) and InlineCommentThread (opens within a checklist row
// itself, used by both task-detail checklist UIs) — same fetch/reply/post
// logic, just rendered inside a different shell.
export function useCommentThread(dependencyItemId: string | null) {
  const [thread, setThread] = useState<CommentThread | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Resets local state ahead of a fresh fetch keyed on dependencyItemId —
    // matches GanttDetailPopup.tsx's identical, established exception to
    // this rule (there's no render-time value to derive it from instead).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!dependencyItemId) { setThread(null); return; }
    setLoading(true);
    fetchCommentThread(dependencyItemId).then((t) => {
      setThread(t);
      setLoading(false);
    });
  }, [dependencyItemId]);

  async function handleReply(parentId: string, body: string) {
    if (!dependencyItemId) return;
    const res = await createComment(dependencyItemId, body, parentId);
    if (res.success && res.data) {
      const reply: ThreadComment = { ...res.data, replies: [] };
      setThread((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          comments: prev.comments.map((c) => (c.id === parentId ? { ...c, replies: [...c.replies, reply] } : c)),
        };
      });
    }
  }

  async function handleNewComment(body: string) {
    if (!dependencyItemId) return;
    const res = await createComment(dependencyItemId, body, null);
    if (res.success && res.data) {
      const created: ThreadComment = { ...res.data, replies: [] };
      setThread((prev) => (prev ? { ...prev, comments: [...prev.comments, created] } : prev));
    }
  }

  return { thread, loading, handleReply, handleNewComment };
}

interface CommentThreadModalProps {
  dependencyItemId: string | null;
  onClose: () => void;
}

// Page-level centered dialog — only used by the aggregated Comments page
// (/works/comments) now, where there's no single "row" to open inline
// within (each card there already IS the item). Checklist rows on the two
// task-detail checklist UIs use InlineCommentThread instead.
export function CommentThreadModal({ dependencyItemId, onClose }: CommentThreadModalProps) {
  const { thread, loading, handleReply, handleNewComment } = useCommentThread(dependencyItemId);

  return (
    <Dialog open={!!dependencyItemId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle>Comments</DialogTitle>
          {thread && (
            <DialogDescription>
              <span className="font-mono text-[11px] text-gray-400 mr-1.5">{thread.context.taskCode}</span>
              {thread.context.taskName} · {CATEGORY_LABELS[thread.context.category]} · {thread.context.itemLabel}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-[12.5px] text-gray-400 text-center py-8">Loading…</p>
          ) : !thread || thread.comments.length === 0 ? (
            <p className="text-[12.5px] text-gray-400 text-center py-8">No comments yet — start the conversation below.</p>
          ) : (
            <div className="space-y-4">
              {thread.comments.map((c) => (
                <CommentRow key={c.id} comment={c} isReply={false} onReply={handleReply} />
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border">
          <CommentInput placeholder="Enter your comment…" onSend={handleNewComment} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
