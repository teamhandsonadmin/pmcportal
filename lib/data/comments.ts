import { prisma } from '@/lib/prisma';
import type { CompletionStatus, DependencyCategory } from '@/lib/types/tasks';

export interface CommentThreadPreview {
  dependencyItemId: string;
  category: DependencyCategory;
  itemLabel: string;
  status: CompletionStatus;
  taskId: string; // Task.id, for linking to its dependencies page
  taskCode: string;
  taskName: string;
  workName: string;
  projectId: string;
  projectName: string;
  commentCount: number;
  latestComment: { body: string; authorName: string; createdAt: Date };
}

// One card per checklist item that has at least one real comment — a global
// audit view across every task/project, newest activity first. Aggregates
// the new threaded Comment model (not DependencyCompletion.comment, which is
// legacy/read-only now — see that field's own schema comment) — the preview
// shown is the thread's most recent comment (which may be a reply), matching
// "what's the latest activity here" rather than always the original post.
export async function getAllCommentThreads(): Promise<CommentThreadPreview[]> {
  const items = await prisma.dependencyItem.findMany({
    where: {
      comments: { some: {} },
      task: { deletedAt: null },
    },
    select: {
      id: true,
      category: true,
      itemLabel: true,
      completion: { select: { status: true } },
      task: {
        select: {
          id: true,
          taskId: true,
          taskName: true,
          work: { select: { name: true, project: { select: { id: true, name: true } } } },
        },
      },
      comments: {
        select: { body: true, createdAt: true, author: { select: { fullName: true } } },
      },
      _count: { select: { comments: true } },
    },
  });

  return items
    .filter((i) => !!i.task?.work?.project && i.comments.length > 0)
    .map((i) => {
      const latest = [...i.comments].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      return {
        dependencyItemId: i.id,
        category: i.category,
        itemLabel: i.itemLabel,
        status: i.completion?.status ?? 'PENDING',
        taskId: i.task!.id,
        taskCode: i.task!.taskId,
        taskName: i.task!.taskName,
        workName: i.task!.work!.name,
        projectId: i.task!.work!.project!.id,
        projectName: i.task!.work!.project!.name,
        commentCount: i._count.comments,
        latestComment: { body: latest.body, authorName: latest.author?.fullName ?? 'Unknown', createdAt: latest.createdAt },
      };
    })
    .sort((a, b) => b.latestComment.createdAt.getTime() - a.latestComment.createdAt.getTime());
}
