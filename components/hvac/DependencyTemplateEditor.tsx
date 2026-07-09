'use client';

import { useRef, useState, useTransition } from 'react';
import {
  addTemplateItem,
  updateTemplateItem,
  deleteTemplateItem,
  reorderTemplateItem,
  applyTemplateToProject,
} from '@/app/actions/dependency-templates';
import { CATEGORY_COLORS } from '@/lib/types/hvac';
import type { DependencyCategory } from '@/lib/types/hvac';

export interface TemplateItem {
  id: string;
  category: DependencyCategory;
  label: string;
  sortOrder: number;
}
export interface ProjectOption {
  id: string;
  name: string;
}

const CATEGORIES: DependencyCategory[] = ['architect', 'client', 'consultant', 'contractor', 'inspector', 'procurement'];
const CATEGORY_LABEL: Record<DependencyCategory, string> = {
  architect: 'Architect',
  client: 'Client',
  consultant: 'Consultant',
  contractor: 'Contractor',
  inspector: 'Vendor',
  procurement: 'Procurement',
};
const CATEGORY_ICON: Record<DependencyCategory, string> = {
  architect: 'ARC',
  client: 'CLT',
  consultant: 'CON',
  contractor: 'CTR',
  inspector: 'VND',
  procurement: 'PRC',
};

export function DependencyTemplateEditor({ items, projects }: { items: TemplateItem[]; projects: ProjectOption[] }) {
  const [expanded, setExpanded] = useState<Set<DependencyCategory>>(new Set(CATEGORIES));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [addingIn, setAddingIn] = useState<DependencyCategory | null>(null);
  const [addText, setAddText] = useState('');
  const [notice, setNotice] = useState('');
  const [showApply, setShowApply] = useState(false);
  const [applyProject, setApplyProject] = useState(projects[0]?.id ?? '');
  const [, startTransition] = useTransition();
  const addRef = useRef<HTMLInputElement>(null);

  function notify(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(''), 2500);
  }

  function toggle(cat: DependencyCategory) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  function startAdd(cat: DependencyCategory) {
    setAddingIn(cat);
    setAddText('');
    setTimeout(() => addRef.current?.focus(), 50);
  }

  function submitAdd(cat: DependencyCategory) {
    if (!addText.trim()) {
      setAddingIn(null);
      return;
    }
    const fd = new FormData();
    fd.set('category', cat);
    fd.set('label', addText.trim());
    startTransition(async () => {
      const res = await addTemplateItem(fd);
      notify(res.success ? 'Item added.' : 'Failed to add item.');
    });
    setAddingIn(null);
    setAddText('');
  }

  function submitEdit(id: string) {
    setEditingId(null);
    if (!editText.trim()) return;
    startTransition(async () => {
      const res = await updateTemplateItem(id, editText.trim());
      notify(res.success ? 'Item updated.' : 'Failed to update item.');
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteTemplateItem(id);
      notify(res.success ? 'Item deleted.' : 'Failed to delete item.');
    });
  }

  function move(id: string, dir: 'up' | 'down') {
    startTransition(async () => {
      await reorderTemplateItem(id, dir);
    });
  }

  function handleApply() {
    if (!applyProject) return;
    startTransition(async () => {
      const res = await applyTemplateToProject(applyProject);
      notify(res.success ? `Applied — ${res.data?.created ?? 0} checklist item(s) added.` : 'Failed to apply template.');
    });
    setShowApply(false);
  }

  const grouped = CATEGORIES.map((cat) => ({
    category: cat,
    items: items.filter((i) => i.category === cat).sort((a, b) => a.sortOrder - b.sortOrder),
  }));
  const totalItems = items.length;

  return (
    <div className="space-y-5">
      {notice && (
        <div
          className="fixed top-5 right-6 z-50 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-[13px] font-medium"
          style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.18)', zIndex: 9999 }}
        >
          {notice}
        </div>
      )}

      {/* Apply to Project modal */}
      {showApply && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowApply(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md overflow-hidden"
            style={{ boxShadow: '0 32px 64px rgba(0,0,0,0.25)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-[15px] font-bold text-gray-900">Apply Template To Project</h2>
              <button
                onClick={() => setShowApply(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-[12.5px] text-gray-500">
                Adds any template checklist item that&apos;s missing from a task&apos;s existing dependencies. Tasks that
                already have all current items — or completed items — are left untouched.
              </p>
              <div>
                <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Project</label>
                {projects.length > 0 ? (
                  <select
                    value={applyProject}
                    onChange={(e) => setApplyProject(e.target.value)}
                    className="w-full px-3 py-2 text-[13px] text-gray-700 bg-gray-50 border border-gray-200 rounded-lg outline-none"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-[12.5px] text-gray-400">No projects yet.</p>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2.5">
              <button
                onClick={() => setShowApply(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-[13px] font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={!applyProject}
                className="px-5 py-2 rounded-lg bg-gray-900 text-white text-[13px] font-semibold hover:bg-gray-700 disabled:opacity-40"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Dependency Templates</h1>
          <p className="text-[13.5px] text-gray-500 mt-1">
            Edit the default checklist items every new task is seeded with, then apply changes to an existing
            project.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => notify('Template saved — all edits are live already.')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
          >
            Save Template
          </button>
          <button
            onClick={() => setShowApply(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-[13px] font-semibold hover:bg-gray-800 transition-colors"
          >
            Apply To Project
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="text-[28px] font-extrabold text-gray-900 leading-none">6</div>
          <div className="text-[12px] font-semibold text-gray-700 mt-1.5">Dependency Categories</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Architect, Client, Consultant, Contractor, Vendor, Procurement</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="text-[28px] font-extrabold text-gray-900 leading-none">{totalItems}</div>
          <div className="text-[12px] font-semibold text-gray-700 mt-1.5">Total Checklist Items</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Seeded onto every new task</div>
        </div>
      </div>

      {/* Category cards */}
      <div className="space-y-3">
        {grouped.map(({ category, items: catItems }) => {
          const colors = CATEGORY_COLORS[category];
          const isOpen = expanded.has(category);
          return (
            <div key={category} className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: colors.badge, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div className="flex items-center gap-3 px-5 py-4" style={{ background: colors.bg, borderBottom: isOpen ? `1px solid ${colors.badge}` : 'none' }}>
                <button onClick={() => toggle(category)} className="flex items-center gap-3 flex-1 text-left">
                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
                    <span className="text-[9px] font-black tracking-tight" style={{ color: colors.text }}>{CATEGORY_ICON[category]}</span>
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold" style={{ color: colors.text }}>{CATEGORY_LABEL[category]}</h3>
                    <p className="text-[11.5px] text-gray-500 mt-0.5">{catItems.length} checklist items</p>
                  </div>
                </button>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => startAdd(category)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11.5px] font-semibold border transition-colors hover:opacity-80"
                    style={{ color: colors.text, borderColor: colors.badge, background: '#fff' }}
                  >
                    + Add Item
                  </button>
                  <button
                    onClick={() => toggle(category)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-white transition-colors"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .2s' }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="divide-y divide-gray-50">
                  {catItems.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-3 px-5 py-3 group hover:bg-gray-50 transition-colors">
                      <div className="flex flex-col gap-0.5 flex-shrink-0">
                        <button onClick={() => move(item.id, 'up')} disabled={idx === 0} className="text-gray-300 hover:text-gray-600 transition-colors leading-none disabled:opacity-20">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15" /></svg>
                        </button>
                        <button onClick={() => move(item.id, 'down')} disabled={idx === catItems.length - 1} className="text-gray-300 hover:text-gray-600 transition-colors leading-none disabled:opacity-20">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                        </button>
                      </div>
                      <span className="w-5 text-[11px] font-bold text-gray-300 tabular-nums flex-shrink-0">{idx + 1}.</span>

                      {editingId === item.id ? (
                        <input
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') submitEdit(item.id); if (e.key === 'Escape') setEditingId(null); }}
                          onBlur={() => submitEdit(item.id)}
                          className="flex-1 text-[13px] text-gray-800 outline-none border-b border-gray-400 bg-transparent pb-0.5"
                          autoFocus
                        />
                      ) : (
                        <span className="flex-1 text-[13px] text-gray-700 font-medium">{item.label}</span>
                      )}

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditingId(item.id); setEditText(item.label); }}
                          className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-200 transition-colors"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => remove(item.id)}
                          className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}

                  {addingIn === category ? (
                    <div className="flex items-center gap-3 px-5 py-3">
                      <input
                        ref={addRef}
                        value={addText}
                        onChange={(e) => setAddText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') submitAdd(category); if (e.key === 'Escape') setAddingIn(null); }}
                        onBlur={() => submitAdd(category)}
                        placeholder="Type checklist item and press Enter…"
                        className="flex-1 text-[13px] text-gray-800 outline-none border-b border-gray-300 bg-transparent pb-0.5 placeholder-gray-400"
                      />
                      <button onClick={() => setAddingIn(null)} className="text-[11px] text-gray-400 hover:text-gray-700">Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startAdd(category)}
                      className="flex items-center gap-2 w-full px-5 py-3 text-left hover:bg-gray-50 transition-colors text-gray-400 hover:text-gray-600"
                    >
                      <span className="text-[12.5px]">+ Add checklist item…</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
