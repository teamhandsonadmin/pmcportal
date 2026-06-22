'use client';

import { useState, useRef } from 'react';

/* ─── Types ───────────────────────────────────────────────────── */
interface ChecklistItem { id: string; label: string; custom?: boolean }
interface Category {
  id: string; name: string; color: string; accent: string;
  border: string; icon: string; items: ChecklistItem[];
}

const INIT_CATEGORIES: Category[] = [
  {
    id: 'architect', name: 'Architect', color: '#F9FAFB', accent: '#374151', border: '#E5E7EB', icon: 'ARC',
    items: [
      { id: 'a1', label: 'Design Intent' },
      { id: 'a2', label: '2D AutoCAD Plan' },
      { id: 'a3', label: '3D Renders' },
      { id: 'a4', label: 'GFC Drawings' },
      { id: 'a5', label: 'Specifications' },
      { id: 'a6', label: 'Material Selection' },
    ],
  },
  {
    id: 'client', name: 'Client', color: '#F9FAFB', accent: '#374151', border: '#E5E7EB', icon: 'CLT',
    items: [
      { id: 'c1', label: 'Design Approval' },
      { id: 'c2', label: 'Material Approval' },
      { id: 'c3', label: 'Equipment Approval' },
      { id: 'c4', label: 'Payment Clearance' },
      { id: 'c5', label: 'Contract Approval' },
    ],
  },
  {
    id: 'consultant', name: 'Consultant', color: '#F9FAFB', accent: '#374151', border: '#E5E7EB', icon: 'CON',
    items: [
      { id: 'co1', label: 'Technical Drawings' },
      { id: 'co2', label: 'Specifications' },
      { id: 'co3', label: 'Vendor Suggestions' },
      { id: 'co4', label: 'Quality Checklist' },
      { id: 'co5', label: 'Estimated Cost' },
    ],
  },
  {
    id: 'vendor', name: 'Vendor', color: '#F9FAFB', accent: '#374151', border: '#E5E7EB', icon: 'VND',
    items: [
      { id: 'v1', label: 'Material Samples' },
      { id: 'v2', label: 'Material Delivery' },
    ],
  },
  {
    id: 'contractor', name: 'Contractor', color: '#F9FAFB', accent: '#374151', border: '#E5E7EB', icon: 'CTR',
    items: [
      { id: 'ct1', label: 'Manpower Availability' },
      { id: 'ct2', label: 'Deadlines' },
      { id: 'ct3', label: 'Quality Of Work' },
      { id: 'ct4', label: 'Mockup On Site' },
    ],
  },
];

interface CustomDep { project: string; category: string; item: string }

const INIT_CUSTOM: CustomDep[] = [
  { project: 'ABC Villa',        category: 'Client',  item: 'Interior Theme Approval' },
  { project: 'ABC Villa',        category: 'Vendor',  item: 'Imported Material Approval' },
  { project: 'ABC Villa',        category: 'Architect',  item: 'Sustainable Design Review' },
  { project: 'ABC Villa',        category: 'Client',     item: 'Vastu Layout Sign-off' },
  { project: 'ABC Villa',        category: 'Consultant', item: 'Soil Report Approval' },
  { project: 'ABC Villa',        category: 'Vendor',     item: 'Premium Fixture Catalogue' },
  { project: 'ABC Villa',        category: 'Contractor',item: 'Specialized Crane Availability' },
];

const PROJECTS = ['ABC Villa'];

let nextId = 1000;
function uid() { return `item-${++nextId}`; }

/* ─── Page ───────────────────────────────────────────────────── */
export default function DependenciesPage() {
  const [categories,   setCategories]   = useState<Category[]>(INIT_CATEGORIES);
  const [customs,      setCustoms]      = useState<CustomDep[]>(INIT_CUSTOM);
  const [expanded,     setExpanded]     = useState<Set<string>>(new Set(['architect', 'client']));
  const [editingItem,  setEditingItem]  = useState<string | null>(null);
  const [editText,     setEditText]     = useState('');
  const [addingIn,     setAddingIn]     = useState<string | null>(null);
  const [addText,      setAddText]      = useState('');
  const [notification, setNotification] = useState('');
  const [showNewCat,   setShowNewCat]   = useState(false);
  const [newCatName,   setNewCatName]   = useState('');
  const [showAssign,   setShowAssign]   = useState(false);
  const [assignProject,setAssignProject]= useState(PROJECTS[0]);
  const [assignCategory,setAssignCategory] = useState('');
  const [assignItem,   setAssignItem]   = useState('');
  const [selectedProj, setSelectedProj] = useState<string | null>(null);
  const addRef = useRef<HTMLInputElement>(null);

  function notify(msg: string) { setNotification(msg); setTimeout(() => setNotification(''), 2500); }
  function toggle(id: string) { setExpanded((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }

  function startEdit(itemId: string, current: string) { setEditingItem(itemId); setEditText(current); }
  function saveEdit(catId: string) {
    if (!editText.trim()) { cancelEdit(); return; }
    setCategories((prev) => prev.map((c) => c.id !== catId ? c : {
      ...c, items: c.items.map((it) => it.id === editingItem ? { ...it, label: editText.trim() } : it),
    }));
    cancelEdit(); notify('Item updated.');
  }
  function cancelEdit() { setEditingItem(null); setEditText(''); }

  function deleteItem(catId: string, itemId: string) {
    setCategories((prev) => prev.map((c) => c.id !== catId ? c : { ...c, items: c.items.filter((it) => it.id !== itemId) }));
    notify('Item deleted.');
  }

  function startAdd(catId: string) { setAddingIn(catId); setAddText(''); setTimeout(() => addRef.current?.focus(), 50); }
  function saveAdd(catId: string) {
    if (!addText.trim()) { setAddingIn(null); return; }
    setCategories((prev) => prev.map((c) => c.id !== catId ? c : {
      ...c, items: [...c.items, { id: uid(), label: addText.trim() }],
    }));
    setAddingIn(null); setAddText(''); notify('Item added.');
  }

  function moveItem(catId: string, itemId: string, dir: -1 | 1) {
    setCategories((prev) => prev.map((c) => {
      if (c.id !== catId) return c;
      const items = [...c.items];
      const idx = items.findIndex((it) => it.id === itemId);
      const target = idx + dir;
      if (target < 0 || target >= items.length) return c;
      [items[idx], items[target]] = [items[target], items[idx]];
      return { ...c, items };
    }));
  }

  function addNewCategory() {
    if (!newCatName.trim()) return;
    setCategories((prev) => [...prev, {
      id: uid(), name: newCatName.trim(),
      color: '#F9FAFB', accent: '#374151', border: '#E5E7EB',
      icon: newCatName.trim().slice(0, 3).toUpperCase(),
      items: [],
    }]);
    setNewCatName(''); setShowNewCat(false);
    setExpanded((prev) => new Set([...prev, `${nextId}`]));
    notify(`Category "${newCatName.trim()}" created.`);
  }

  function deleteCategory(catId: string) {
    setCategories((prev) => prev.filter((c) => c.id !== catId));
    notify('Category deleted.');
  }

  function handleAssign() {
    if (!assignItem.trim()) { notify('Please enter a checklist item.'); return; }
    setCustoms((prev) => [...prev, { project: assignProject, category: assignCategory || categories[0].name, item: assignItem.trim() }]);
    setAssignItem(''); setShowAssign(false);
    notify(`Custom dependency added to ${assignProject}`);
  }

  const totalItems = categories.reduce((s, c) => s + c.items.length, 0);

  const projCustoms = customs.filter((c) => c.project === selectedProj);

  return (
    <div className="space-y-5">

      {/* ── Toast ─────────────────────────────────────────── */}
      {notification && (
        <div className="fixed top-5 right-6 z-50 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-[13px] font-medium"
          style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.18)', zIndex: 9999 }}>
          {notification}
        </div>
      )}

      {/* ── Assign Modal ───────────────────────────────────── */}
      {showAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowAssign(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden"
            style={{ boxShadow: '0 32px 64px rgba(0,0,0,0.25)' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-[15px] font-bold text-gray-900">Add Custom Dependency</h2>
              <button onClick={() => setShowAssign(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <MField label="Project">
                <select value={assignProject} onChange={(e) => setAssignProject(e.target.value)}
                  className="dep-select">
                  {PROJECTS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </MField>
              <MField label="Dependency Category">
                <select value={assignCategory || categories[0]?.name}
                  onChange={(e) => setAssignCategory(e.target.value)}
                  className="dep-select">
                  {categories.map((c) => <option key={c.id}>{c.name}</option>)}
                </select>
              </MField>
              <MField label="Checklist Item *">
                <input value={assignItem} onChange={(e) => setAssignItem(e.target.value)}
                  placeholder="e.g. Interior Theme Approval"
                  className="dep-input" />
              </MField>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2.5">
              <button onClick={() => setShowAssign(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-[13px] font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleAssign}
                className="px-5 py-2 rounded-lg bg-gray-900 text-white text-[13px] font-semibold hover:bg-gray-700">Add Dependency</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Dependencies Management</h1>
          <p className="text-[13.5px] text-gray-500 mt-1">Configure project dependencies and checklist requirements.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button onClick={() => notify('Template saved successfully!')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
            </svg>
            Save Template
          </button>
          <button onClick={() => setShowAssign(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            Apply To Project
          </button>
          <button onClick={() => { setShowNewCat(true); setNewCatName(''); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-[13px] font-semibold hover:bg-gray-800 transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Create Category
          </button>
        </div>
      </div>

      {/* ── Summary Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Dependency Categories', value: categories.length, sub: 'Architect, Client, Vendor…', dot: '#3B82F6' },
          { label: 'Total Checklist Items',  value: totalItems,        sub: 'Across all categories',     dot: '#10B981' },
          { label: 'Projects Using Templates',value: 18,               sub: 'Active this month',          dot: '#8B5CF6' },
          { label: 'Custom Dependencies',    value: customs.length,   sub: 'Project-specific items',     dot: '#F97316' },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-5"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="w-2 h-2 rounded-full" style={{ background: c.dot }} />
            </div>
            <div className="text-[28px] font-extrabold text-gray-900 leading-none">{c.value}</div>
            <div className="text-[12px] font-semibold text-gray-700 mt-1.5">{c.label}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* ── New Category inline form ───────────────────────── */}
      {showNewCat && (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 px-5 py-4 flex items-center gap-3"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addNewCategory(); if (e.key === 'Escape') setShowNewCat(false); }}
            placeholder="New category name (e.g. Procurement)…"
            className="flex-1 text-[13px] text-gray-800 outline-none placeholder-gray-400 bg-transparent" autoFocus />
          <button onClick={addNewCategory}
            className="px-4 py-1.5 rounded-lg bg-gray-900 text-white text-[12.5px] font-semibold hover:bg-gray-700 transition-colors">
            Create
          </button>
          <button onClick={() => setShowNewCat(false)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-[12.5px] text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
        </div>
      )}

      <div className="grid grid-cols-12 gap-5">

        {/* ── Category cards ────────────────────────────────── */}
        <div className="col-span-8 space-y-3">
          {categories.map((cat) => {
            const isOpen = expanded.has(cat.id);
            return (
              <div key={cat.id} className="bg-white rounded-xl border overflow-hidden"
                style={{ borderColor: cat.border, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>

                {/* Category header */}
                <div className="flex items-center gap-3 px-5 py-4"
                  style={{ background: cat.color, borderBottom: isOpen ? `1px solid ${cat.border}` : 'none' }}>
                  <button onClick={() => toggle(cat.id)} className="flex items-center gap-3 flex-1 text-left">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-black text-gray-500 tracking-tight">{cat.icon}</span>
                    </div>
                    <div>
                      <h3 className="text-[14px] font-bold" style={{ color: cat.accent }}>{cat.name}</h3>
                      <p className="text-[11.5px] text-gray-500 mt-0.5">{cat.items.length} checklist items</p>
                    </div>
                    <div className="ml-3 flex gap-1 flex-wrap">
                      {cat.items.slice(0, 3).map((it) => (
                        <span key={it.id} className="px-2 py-0.5 rounded-full text-[10.5px] font-medium border"
                          style={{ background: '#fff', color: cat.accent, borderColor: cat.border }}>
                          {it.label}
                        </span>
                      ))}
                      {cat.items.length > 3 && (
                        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-white border"
                          style={{ color: cat.accent, borderColor: cat.border }}>
                          +{cat.items.length - 3} more
                        </span>
                      )}
                    </div>
                  </button>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => startAdd(cat.id)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11.5px] font-semibold border transition-colors hover:opacity-80"
                      style={{ color: cat.accent, borderColor: cat.border, background: '#fff' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Add Item
                    </button>
                    <button onClick={() => deleteCategory(cat.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>
                      </svg>
                    </button>
                    <button onClick={() => toggle(cat.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-white transition-colors">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                        style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .2s' }}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Checklist items */}
                {isOpen && (
                  <div className="divide-y divide-gray-50">
                    {cat.items.map((item, idx) => (
                      <div key={item.id} className="flex items-center gap-3 px-5 py-3 group hover:bg-gray-50 transition-colors">
                        {/* Drag handle / reorder */}
                        <div className="flex flex-col gap-0.5 flex-shrink-0">
                          <button onClick={() => moveItem(cat.id, item.id, -1)}
                            className="text-gray-300 hover:text-gray-600 transition-colors leading-none disabled:opacity-20"
                            disabled={idx === 0}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15"/></svg>
                          </button>
                          <button onClick={() => moveItem(cat.id, item.id, 1)}
                            className="text-gray-300 hover:text-gray-600 transition-colors leading-none disabled:opacity-20"
                            disabled={idx === cat.items.length - 1}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                          </button>
                        </div>

                        {/* Number */}
                        <span className="w-5 text-[11px] font-bold text-gray-300 tabular-nums flex-shrink-0">{idx + 1}.</span>

                        {/* Checkbox icon */}
                        <div className="w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center"
                          style={{ borderColor: cat.accent }}>
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={cat.accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </div>

                        {/* Label */}
                        {editingItem === item.id ? (
                          <input value={editText} onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(cat.id); if (e.key === 'Escape') cancelEdit(); }}
                            onBlur={() => saveEdit(cat.id)}
                            className="flex-1 text-[13px] text-gray-800 outline-none border-b border-gray-400 bg-transparent pb-0.5" autoFocus />
                        ) : (
                          <span className="flex-1 text-[13px] text-gray-700 font-medium">{item.label}</span>
                        )}

                        {/* Item badge */}
                        {item.custom && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full border text-orange-600 border-orange-200 bg-orange-50 font-semibold">Custom</span>
                        )}

                        {/* Actions — appear on hover */}
                        {editingItem !== item.id && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEdit(item.id, item.label)}
                              className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-200 transition-colors">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                            <button onClick={() => deleteItem(cat.id, item.id)}
                              className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                                <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Inline add */}
                    {addingIn === cat.id ? (
                      <div className="flex items-center gap-3 px-5 py-3">
                        <div className="w-4 h-4 rounded border-2 flex-shrink-0" style={{ borderColor: cat.accent }} />
                        <input ref={addRef} value={addText}
                          onChange={(e) => setAddText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveAdd(cat.id); if (e.key === 'Escape') setAddingIn(null); }}
                          onBlur={() => saveAdd(cat.id)}
                          placeholder="Type checklist item and press Enter…"
                          className="flex-1 text-[13px] text-gray-800 outline-none border-b border-gray-300 bg-transparent pb-0.5 placeholder-gray-400" />
                        <button onClick={() => setAddingIn(null)}
                          className="text-[11px] text-gray-400 hover:text-gray-700">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => startAdd(cat.id)}
                        className="flex items-center gap-2 w-full px-5 py-3 text-left hover:bg-gray-50 transition-colors text-gray-400 hover:text-gray-600">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        <span className="text-[12.5px]">Add checklist item…</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Empty + Create CTA */}
          <button onClick={() => { setShowNewCat(true); setNewCatName(''); }}
            className="w-full bg-white rounded-xl border-2 border-dashed border-gray-200 py-5 flex items-center justify-center gap-2.5 hover:border-gray-400 hover:bg-gray-50 transition-all"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </div>
            <span className="text-[13px] font-semibold text-gray-500">Create New Dependency Category</span>
          </button>
        </div>

        {/* ── Right Panel ───────────────────────────────────── */}
        <div className="col-span-4 space-y-4">

          {/* Template summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-5"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 className="text-[12.5px] font-bold text-gray-900 uppercase tracking-wider mb-3">Template Summary</h3>
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                <span className="text-[15px]">{cat.icon}</span>
                <div className="flex-1">
                  <p className="text-[12.5px] font-semibold text-gray-800">{cat.name}</p>
                  <p className="text-[11px] text-gray-400">{cat.items.length} items</p>
                </div>
                <div className="flex gap-0.5">
                  {Array.from({ length: Math.min(cat.items.length, 5) }).map((_, i) => (
                    <div key={i} className="w-2 h-5 rounded-sm" style={{ background: cat.accent, opacity: 0.2 + i * 0.15 }} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Project assignment */}
          <div className="bg-white rounded-xl border border-gray-200 p-5"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 className="text-[12.5px] font-bold text-gray-900 uppercase tracking-wider mb-3">View By Project</h3>
            <div className="space-y-1.5">
              {PROJECTS.map((proj) => {
                const count = customs.filter((c) => c.project === proj).length;
                const active = selectedProj === proj;
                return (
                  <button key={proj} onClick={() => setSelectedProj(active ? null : proj)}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-left transition-all"
                    style={{
                      background: active ? '#111111' : '#f9fafb',
                      color:      active ? '#ffffff'  : '#374151',
                    }}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: active ? 'rgba(255,255,255,0.2)' : '#e5e7eb' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                      </svg>
                    </div>
                    <span className="flex-1 text-[12.5px] font-medium">{proj}</span>
                    {count > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: active ? 'rgba(255,255,255,0.2)' : '#f3f4f6', color: active ? '#fff' : '#6b7280' }}>
                        +{count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom dependencies for selected project */}
          {selectedProj && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between"
                style={{ background: '#f9fafb' }}>
                <div>
                  <h3 className="text-[12.5px] font-bold text-gray-900">{selectedProj}</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">Custom dependencies</p>
                </div>
                <button onClick={() => { setAssignProject(selectedProj); setShowAssign(true); }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11.5px] font-semibold bg-gray-900 text-white hover:bg-gray-700 transition-colors">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Add
                </button>
              </div>
              {projCustoms.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-[12.5px] text-gray-400">No custom dependencies yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {projCustoms.map((c, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 group">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-semibold text-gray-800">{c.item}</p>
                        <p className="text-[11px] text-gray-400">{c.category}</p>
                      </div>
                      <button onClick={() => {
                        setCustoms((prev) => prev.filter((_, ii) => {
                          const idx2 = customs.indexOf(c); return ii !== idx2;
                        })); notify('Custom dependency removed.');
                      }}
                        className="w-5 h-5 rounded flex items-center justify-center text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* All custom dependencies */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-[12.5px] font-bold text-gray-900 uppercase tracking-wider">All Custom Dependencies</h3>
              <span className="text-[11px] text-gray-400">{customs.length} total</span>
            </div>
            <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
              {customs.map((c, i) => (
                <div key={i} className="flex items-start gap-2.5 px-4 py-2.5 group hover:bg-gray-50 transition-colors">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-orange-50 border border-orange-200 text-orange-600 mt-0.5 flex-shrink-0">
                    {c.category.slice(0, 3).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-gray-800 truncate">{c.item}</p>
                    <p className="text-[10.5px] text-gray-400">{c.project}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-gray-100">
              <button onClick={() => setShowAssign(true)}
                className="w-full py-2 rounded-lg text-[12.5px] font-semibold border-2 border-dashed border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-all">
                + Add Custom Dependency
              </button>
            </div>
          </div>

        </div>
      </div>

      <style>{`
        .dep-input { width:100%; padding:8px 12px; font-size:13px; color:#111827; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; outline:none; }
        .dep-input:focus { border-color:#9ca3af; background:#fff; }
        .dep-select { width:100%; padding:8px 12px; font-size:13px; color:#374151; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; outline:none; }
      `}</style>
    </div>
  );
}

/* ─── Modal field ─────────────────────────────────────────────── */
function MField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
