import { getAllCommentThreads } from '@/lib/data/comments';
import { CommentsExplorer } from '@/components/tasks/CommentsExplorer';

export const dynamic = 'force-dynamic';

export default async function CommentsPage() {
  const comments = await getAllCommentThreads();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Comments</h1>
        <p className="text-[13.5px] text-gray-500 mt-1">
          Every checklist comment across every task, in one place — newest first.
        </p>
      </div>

      <CommentsExplorer comments={comments} />
    </div>
  );
}
