'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getCurrentUserProfile } from '@/lib/auth/current-user';
import { getCommentThread, type CommentThread } from '@/lib/data/comment-thread';
import type { ActionResult } from '@/lib/types/tasks';

export interface CreatedComment {
  id: string;
  body: string;
  createdAt: Date;
  authorName: string;
  authorId: string | null;
  parentCommentId: string | null;
}

// Thin server-action wrapper around the data-layer read — CommentThreadModal
// is a client component and can't import lib/data/comment-thread.ts directly
// (it pulls in prisma/pg, which can't run in the browser; same issue fixed
// earlier for the client report's Gantt view).
export async function fetchCommentThread(dependencyItemId: string): Promise<CommentThread | null> {
  return getCommentThread(dependencyItemId);
}

export async function createComment(
  dependencyItemId: string,
  body: string,
  parentCommentId: string | null
): Promise<ActionResult<CreatedComment>> {
  const trimmed = body.trim();
  if (!trimmed) return { success: false, error: 'Comment cannot be empty' };

  // Unattributed (authorId: null) rather than rejected when there's no
  // resolvable session — posting a comment isn't a privileged action the
  // way sending a client report or touching a client's own draft is.
  const profile = await getCurrentUserProfile();

  const created = await prisma.comment.create({
    data: {
      dependencyItemId,
      body: trimmed,
      parentCommentId: parentCommentId ?? null,
      authorId: profile?.id ?? null,
    },
    select: { id: true, body: true, createdAt: true, parentCommentId: true, authorId: true },
  });

  revalidatePath('/works/comments');

  return {
    success: true,
    data: {
      id: created.id,
      body: created.body,
      createdAt: created.createdAt,
      authorName: profile?.fullName ?? 'Unknown',
      authorId: created.authorId,
      parentCommentId: created.parentCommentId,
    },
  };
}
