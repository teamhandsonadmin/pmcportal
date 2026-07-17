'use client';

import { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { STATUS_CHIP } from '@/components/hvac/StatusDropdown';
import { CommentThreadModal } from '@/components/hvac/CommentThreadModal';
import type { CommentThreadPreview } from '@/lib/data/comments';
import type { DependencyCategory } from '@/lib/types/hvac';

// Duplicated rather than shared, matching this codebase's established
// convention for this exact map (already independently defined in
// DependencyChecklist.tsx, DependencyProgress.tsx, GanttTaskBars.tsx).
const CATEGORY_LABELS: Record<DependencyCategory, string> = {
  architect: 'Architect',
  client: 'Client',
  consultant: 'Consultant',
  contractor: 'Contractor',
  inspector: 'Inspector',
  procurement: 'Procurement',
};

function CommentCard({ c, onOpen }: { c: CommentThreadPreview; onOpen: () => void }) {
  const chip = STATUS_CHIP[c.status];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-left bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all w-full"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold text-gray-900 truncate">{c.taskName}</p>
          <p className="text-[11.5px] text-gray-400 mt-0.5">
            {c.projectName} · {c.workName}
          </p>
        </div>
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold flex-shrink-0"
          style={{ backgroundColor: chip.bg, color: chip.text }}
        >
          <span className="w-[5px] h-[5px] rounded-full flex-shrink-0" style={{ backgroundColor: chip.dot }} />
          {chip.label}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10.5px] font-bold uppercase tracking-wide text-gray-400 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5">
          {CATEGORY_LABELS[c.category]}
        </span>
        <span className="text-[11.5px] text-gray-500 truncate">{c.itemLabel}</span>
      </div>

      <p className="text-[13px] text-gray-700 leading-relaxed italic">&ldquo;{c.latestComment.body}&rdquo;</p>

      <div className="flex items-center justify-between mt-2.5">
        <p className="text-[10.5px] text-gray-400">
          {c.latestComment.authorName} · {formatDistanceToNow(c.latestComment.createdAt, { addSuffix: true })}
        </p>
        <p className="text-[10.5px] text-gray-400">
          {c.commentCount} comment{c.commentCount === 1 ? '' : 's'}
        </p>
      </div>
    </button>
  );
}

export function CommentsExplorer({ comments }: { comments: CommentThreadPreview[] }) {
  const [search, setSearch] = useState('');
  const [projectF, setProjectF] = useState('');
  const [categoryF, setCategoryF] = useState<DependencyCategory | ''>('');
  const [openItemId, setOpenItemId] = useState<string | null>(null);

  const projectOptions = useMemo(() => [...new Set(comments.map((c) => c.projectName))].sort(), [comments]);
  const categoryOptions = useMemo(
    () => (Object.keys(CATEGORY_LABELS) as DependencyCategory[]).filter((cat) => comments.some((c) => c.category === cat)),
    [comments]
  );

  const filtered = useMemo(
    () =>
      comments.filter(
        (c) =>
          (!search ||
            c.taskName.toLowerCase().includes(search.toLowerCase()) ||
            c.latestComment.body.toLowerCase().includes(search.toLowerCase()) ||
            c.itemLabel.toLowerCase().includes(search.toLowerCase())) &&
          (!projectF || c.projectName === projectF) &&
          (!categoryF || c.category === categoryF)
      ),
    [comments, search, projectF, categoryF]
  );

  const hasFilter = !!(search || projectF || categoryF);
  const clearFilters = () => { setSearch(''); setProjectF(''); setCategoryF(''); };

  if (comments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-gray-200 rounded-lg">
        <p className="text-[13px] font-semibold text-gray-400">No comments yet</p>
        <p className="text-[12px] text-gray-400 mt-1">
          Comments added on any task&apos;s checklist items will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 max-w-xs">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search task, item, or comment…"
            className="bg-transparent text-[12.5px] text-gray-700 placeholder-gray-400 outline-none flex-1"
          />
        </div>

        <select
          value={projectF}
          onChange={(e) => setProjectF(e.target.value)}
          className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-[12.5px] text-gray-600 outline-none cursor-pointer hover:border-gray-400 transition-colors"
        >
          <option value="">All Projects</option>
          {projectOptions.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <select
          value={categoryF}
          onChange={(e) => setCategoryF(e.target.value as DependencyCategory | '')}
          className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-[12.5px] text-gray-600 outline-none cursor-pointer hover:border-gray-400 transition-colors"
        >
          <option value="">All Departments</option>
          {categoryOptions.map((cat) => <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>)}
        </select>

        {hasFilter && (
          <button onClick={clearFilters} className="text-[12px] font-semibold text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">
            Clear filters
          </button>
        )}

        <span className="text-[11.5px] text-gray-400 ml-auto">{filtered.length} of {comments.length} comments</span>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-gray-200 rounded-lg">
          <p className="text-[13px] font-semibold text-gray-300">No comments match these filters</p>
          <button onClick={clearFilters} className="mt-3 text-[12px] font-semibold text-gray-400 hover:text-gray-900 underline">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((c) => (
            <CommentCard key={c.dependencyItemId} c={c} onOpen={() => setOpenItemId(c.dependencyItemId)} />
          ))}
        </div>
      )}

      <CommentThreadModal dependencyItemId={openItemId} onClose={() => setOpenItemId(null)} />
    </div>
  );
}
