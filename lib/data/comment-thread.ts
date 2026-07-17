import { prisma } from '@/lib/prisma';
import type { DependencyCategory } from '@/lib/types/hvac';

export interface ThreadComment {
  id: string;
  body: string;
  createdAt: Date;
  authorName: string;
  authorId: string | null;
  parentCommentId: string | null;
  replies: ThreadComment[];
}

export interface CommentThreadContext {
  dependencyItemId: string;
  itemLabel: string;
  category: DependencyCategory;
  taskId: string;
  taskCode: string;
  taskName: string;
}

export interface CommentThread {
  context: CommentThreadContext;
  comments: ThreadComment[]; // top-level only; each carries its own replies
}

// One checklist item's full comment thread — the data backing the shared
// CommentThreadModal, regardless of which page opened it (the aggregated
// Comments page, or a per-task checklist item's comment icon). Only two
// levels are modeled here (top-level + replies) since the UI only ever
// offers "Reply" on a top-level comment — the schema itself supports
// deeper nesting (Comment.parentCommentId is self-referencing), this is a
// UI-driven simplification, not a data-model limit.
export async function getCommentThread(dependencyItemId: string): Promise<CommentThread | null> {
  const [item, rows] = await Promise.all([
    prisma.dependencyItem.findUnique({
      where: { id: dependencyItemId },
      select: {
        id: true,
        itemLabel: true,
        category: true,
        task: { select: { id: true, taskId: true, taskName: true } },
      },
    }),
    prisma.comment.findMany({
      where: { dependencyItemId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        body: true,
        createdAt: true,
        parentCommentId: true,
        authorId: true,
        author: { select: { fullName: true } },
      },
    }),
  ]);

  if (!item || !item.task) return null;

  const byId = new Map<string, ThreadComment>();
  for (const r of rows) {
    byId.set(r.id, {
      id: r.id,
      body: r.body,
      createdAt: r.createdAt,
      authorName: r.author?.fullName ?? 'Unknown',
      authorId: r.authorId,
      parentCommentId: r.parentCommentId,
      replies: [],
    });
  }

  const topLevel: ThreadComment[] = [];
  for (const r of rows) {
    const node = byId.get(r.id)!;
    if (r.parentCommentId && byId.has(r.parentCommentId)) {
      byId.get(r.parentCommentId)!.replies.push(node);
    } else {
      topLevel.push(node);
    }
  }

  return {
    context: {
      dependencyItemId: item.id,
      itemLabel: item.itemLabel,
      category: item.category,
      taskId: item.task.id,
      taskCode: item.task.taskId,
      taskName: item.task.taskName,
    },
    comments: topLevel,
  };
}
