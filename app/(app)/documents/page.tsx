'use client';

import { useState, useMemo } from 'react';

/* ─── Types ───────────────────────────────────────────────────── */
type FileType = 'PDF' | 'DWG' | 'DOCX' | 'XLSX' | 'ZIP' | 'PNG' | 'JPG';
type FolderId =
  | 'abc-villa' | 'green-heights' | 'swathi' | 'hvac'
  | 'electrical' | 'approvals' | 'site-instructions' | 'boq';

interface DocFile {
  id: string; name: string; folder: FolderId;
  uploadedBy: string; date: string; type: FileType; size: string;
}

/* ─── Static data ─────────────────────────────────────────────── */
const FOLDERS: { id: FolderId; label: string; count: number }[] = [
  { id: 'abc-villa',          label: 'ABC Villa Project',     count: 42 },
  { id: 'green-heights',      label: 'Block A Drawings',      count: 38 },
  { id: 'swathi',             label: 'Block B Drawings',       count: 29 },
  { id: 'hvac',               label: 'HVAC Drawings',         count: 31 },
  { id: 'electrical',         label: 'Electrical Drawings',   count: 27 },
  { id: 'approvals',          label: 'Approvals',             count: 22 },
  { id: 'site-instructions',  label: 'Site Instructions',     count: 34 },
  { id: 'boq',                label: 'BOQ & Specifications',  count: 25 },
];

const FILES: DocFile[] = [
  { id: 'd01', name: 'HVAC Layout Rev-03.pdf',        folder: 'hvac',              uploadedBy: 'Kumar S',   date: '22 Jun 2026', type: 'PDF',  size: '4.2 MB' },
  { id: 'd02', name: 'HVAC Duct Schedule.xlsx',       folder: 'hvac',              uploadedBy: 'Kumar S',   date: '20 Jun 2026', type: 'XLSX', size: '1.8 MB' },
  { id: 'd03', name: 'HVAC Equipment List.docx',      folder: 'hvac',              uploadedBy: 'Priya R',   date: '18 Jun 2026', type: 'DOCX', size: '0.9 MB' },
  { id: 'd04', name: 'AHU Location Plan Rev-01.dwg',  folder: 'hvac',              uploadedBy: 'Kumar S',   date: '15 Jun 2026', type: 'DWG',  size: '7.3 MB' },
  { id: 'd05', name: 'Electrical Plan.pdf',           folder: 'electrical',        uploadedBy: 'Arjun K',   date: '21 Jun 2026', type: 'PDF',  size: '3.1 MB' },
  { id: 'd06', name: 'Panel Board Schedule.xlsx',     folder: 'electrical',        uploadedBy: 'Arjun K',   date: '19 Jun 2026', type: 'XLSX', size: '1.2 MB' },
  { id: 'd07', name: 'LV Conduit Routing.dwg',        folder: 'electrical',        uploadedBy: 'Arjun K',   date: '17 Jun 2026', type: 'DWG',  size: '5.6 MB' },
  { id: 'd08', name: 'Earthing Layout.pdf',           folder: 'electrical',        uploadedBy: 'Ravi M',    date: '14 Jun 2026', type: 'PDF',  size: '2.4 MB' },
  { id: 'd09', name: 'Client Approval Letter.pdf',    folder: 'approvals',         uploadedBy: 'Admin',     date: '20 Jun 2026', type: 'PDF',  size: '1.5 MB' },
  { id: 'd10', name: 'Design Approval - Phase 2.pdf', folder: 'approvals',         uploadedBy: 'Admin',     date: '18 Jun 2026', type: 'PDF',  size: '2.0 MB' },
  { id: 'd11', name: 'Consultant Sign-off.pdf',       folder: 'approvals',         uploadedBy: 'Admin',     date: '16 Jun 2026', type: 'PDF',  size: '0.8 MB' },
  { id: 'd12', name: 'ABC Villa Floor Plans.pdf',     folder: 'abc-villa',         uploadedBy: 'Priya R',   date: '22 Jun 2026', type: 'PDF',  size: '6.1 MB' },
  { id: 'd13', name: 'Villa BOQ Summary.xlsx',        folder: 'abc-villa',         uploadedBy: 'Admin',     date: '21 Jun 2026', type: 'XLSX', size: '3.5 MB' },
  { id: 'd14', name: 'Construction Photos Jun.zip',   folder: 'abc-villa',         uploadedBy: 'Kumar S',   date: '22 Jun 2026', type: 'ZIP',  size: '88.0 MB' },
  { id: 'd15', name: 'Block A Master Plan Rev-02.dwg', folder: 'green-heights',   uploadedBy: 'Sanjay T',  date: '20 Jun 2026', type: 'DWG',  size: '9.8 MB' },
  { id: 'd16', name: 'Block A BOQ Summary.xlsx',        folder: 'green-heights',  uploadedBy: 'Admin',     date: '19 Jun 2026', type: 'XLSX', size: '4.2 MB' },
  { id: 'd17', name: 'Block A Progress Report.docx',    folder: 'green-heights',  uploadedBy: 'Sanjay T',  date: '18 Jun 2026', type: 'DOCX', size: '1.7 MB' },
  { id: 'd18', name: 'Block B Layout Plan.pdf',         folder: 'swathi',         uploadedBy: 'Priya R',   date: '17 Jun 2026', type: 'PDF',  size: '5.4 MB' },
  { id: 'd19', name: 'Block B Structural Drawings.dwg', folder: 'swathi',         uploadedBy: 'Ravi M',    date: '15 Jun 2026', type: 'DWG',  size: '12.3 MB' },
  { id: 'd20', name: 'SI-001 Foundation Works.pdf',   folder: 'site-instructions', uploadedBy: 'Admin',     date: '21 Jun 2026', type: 'PDF',  size: '1.1 MB' },
  { id: 'd21', name: 'SI-002 Slab Casting.pdf',       folder: 'site-instructions', uploadedBy: 'Admin',     date: '20 Jun 2026', type: 'PDF',  size: '0.9 MB' },
  { id: 'd22', name: 'SI-003 Waterproofing.pdf',      folder: 'site-instructions', uploadedBy: 'Kumar S',   date: '18 Jun 2026', type: 'PDF',  size: '1.3 MB' },
  { id: 'd23', name: 'BOQ - Civil Works.xlsx',        folder: 'boq',               uploadedBy: 'Admin',     date: '22 Jun 2026', type: 'XLSX', size: '5.7 MB' },
  { id: 'd24', name: 'Specifications Doc.docx',       folder: 'boq',               uploadedBy: 'Priya R',   date: '16 Jun 2026', type: 'DOCX', size: '2.2 MB' },
  { id: 'd25', name: 'Site Aerial Photo.jpg',         folder: 'abc-villa',         uploadedBy: 'Kumar S',   date: '22 Jun 2026', type: 'JPG',  size: '3.8 MB' },
];

/* ─── File type config ────────────────────────────────────────── */
const TYPE_CONFIG: Record<FileType, { bg: string; text: string; icon: string }> = {
  PDF:  { bg: '#FEF2F2', text: '#B91C1C', icon: 'PDF' },
  DWG:  { bg: '#EFF6FF', text: '#1D4ED8', icon: 'DWG' },
  DOCX: { bg: '#F0F9FF', text: '#0369A1', icon: 'DOC' },
  XLSX: { bg: '#F0FDF4', text: '#166534', icon: 'XLS' },
  ZIP:  { bg: '#FEFCE8', text: '#854D0E', icon: 'ZIP' },
  PNG:  { bg: '#FAF5FF', text: '#7C3AED', icon: 'IMG' },
  JPG:  { bg: '#FAF5FF', text: '#7C3AED', icon: 'IMG' },
};

/* ─── Folder icon SVG ─────────────────────────────────────────── */
function FolderIcon({ active }: { active?: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={active ? '#111111' : 'none'}
      stroke={active ? '#111111' : '#6b7280'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
      <polyline points="13 2 13 9 20 9"/>
    </svg>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function DocumentsPage() {
  const [activeFolder, setActiveFolder] = useState<FolderId | 'all'>('all');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<FileType | 'all'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notification, setNotification] = useState('');

  const filtered = useMemo(() => FILES.filter((f) => {
    const matchFolder = activeFolder === 'all' || f.folder === activeFolder;
    const matchSearch = !search || f.name.toLowerCase().includes(search.toLowerCase())
      || f.uploadedBy.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || f.type === typeFilter;
    return matchFolder && matchSearch && matchType;
  }), [activeFolder, search, typeFilter]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function notify(msg: string) {
    setNotification(msg);
    setTimeout(() => setNotification(''), 2500);
  }

  const folderLabel = activeFolder === 'all'
    ? 'All Documents'
    : FOLDERS.find((f) => f.id === activeFolder)?.label ?? 'Documents';

  return (
    <div className="space-y-5">

      {/* ── Toast ─────────────────────────────────────────── */}
      {notification && (
        <div className="fixed top-5 right-6 z-50 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-[13px] font-medium shadow-xl"
          style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
          {notification}
        </div>
      )}

      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Documents</h1>
          <p className="text-[13.5px] text-gray-500 mt-1">Store, organize, and access project documents.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button onClick={() => notify('Create Folder: Feature coming soon')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              <line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
            </svg>
            New Folder
          </button>
          <button onClick={() => notify('Upload File: Feature coming soon')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-[13px] font-medium hover:bg-gray-800 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
            </svg>
            Upload File
          </button>
        </div>
      </div>

      {/* ── Summary Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Documents', value: '248',    sub: 'Across all folders',  icon: 'DOC', iconBg: '#FEF2F2', iconText: '#B91C1C' },
          { label: 'Total Folders',   value: '32',     sub: '8 active projects',   icon: 'FLD', iconBg: '#FFF7ED', iconText: '#C2410C' },
          { label: 'Recent Uploads',  value: '18',     sub: 'Last 7 days',         icon: 'NEW', iconBg: '#F0FDF4', iconText: '#166534' },
          { label: 'Storage Used',    value: '4.8 GB', sub: 'of 20 GB limit',      icon: 'STO', iconBg: '#EFF6FF', iconText: '#1D4ED8' },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-5"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: c.iconBg }}>
                <span className="text-[8px] font-black leading-none" style={{ color: c.iconText }}>{c.icon}</span>
              </div>
            </div>
            <div className="text-[26px] font-extrabold text-gray-900 leading-none">{c.value}</div>
            <div className="text-[12px] font-semibold text-gray-700 mt-1.5">{c.label}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Main layout ────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-5">

        {/* Folder tree */}
        <div className="col-span-3">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-[12.5px] font-bold text-gray-900 uppercase tracking-wider">Folders</h3>
              <span className="text-[10px] text-gray-400 font-semibold">{FOLDERS.length} folders</span>
            </div>

            <div className="py-2">
              {/* All documents */}
              <button onClick={() => setActiveFolder('all')}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-left transition-colors"
                style={{
                  background: activeFolder === 'all' ? '#f3f4f6' : 'transparent',
                  color:      activeFolder === 'all' ? '#111111' : '#4b5563',
                }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                <span className="text-[12.5px] font-semibold flex-1">All Documents</span>
                <span className="text-[10.5px] text-gray-400">248</span>
              </button>

              <div className="h-px bg-gray-100 mx-4 my-1.5" />

              {FOLDERS.map((f) => (
                <button key={f.id} onClick={() => setActiveFolder(f.id)}
                  className="flex items-center gap-2.5 w-full px-4 py-2 text-left transition-colors"
                  style={{
                    background: activeFolder === f.id ? '#f3f4f6' : 'transparent',
                    color:      activeFolder === f.id ? '#111111' : '#4b5563',
                  }}
                  onMouseEnter={(e) => {
                    if (activeFolder !== f.id)
                      (e.currentTarget as HTMLElement).style.background = '#f9fafb';
                  }}
                  onMouseLeave={(e) => {
                    if (activeFolder !== f.id)
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}>
                  <FolderIcon active={activeFolder === f.id} />
                  <span className="text-[12.5px] flex-1 truncate font-medium">{f.label}</span>
                  <span className="text-[10.5px] text-gray-400 flex-shrink-0">{f.count}</span>
                </button>
              ))}
            </div>

            {/* Storage bar */}
            <div className="border-t border-gray-100 px-4 py-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11.5px] font-semibold text-gray-600">Storage</span>
                <span className="text-[11px] text-gray-400">4.8 / 20 GB</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-gray-900" style={{ width: '24%' }} />
              </div>
              <p className="text-[10.5px] text-gray-400 mt-1.5">24% used</p>
            </div>
          </div>
        </div>

        {/* File browser */}
        <div className="col-span-9 space-y-3">

          {/* Search & filter bar */}
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            {/* Search */}
            <div className="flex items-center gap-2 flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search documents…"
                className="flex-1 bg-transparent text-[13px] text-gray-700 placeholder-gray-400 outline-none" />
              {search && (
                <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>

            {/* Type filter */}
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as FileType | 'all')}
              className="text-[12.5px] text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none">
              <option value="all">All Types</option>
              {(['PDF', 'DWG', 'DOCX', 'XLSX', 'ZIP', 'PNG', 'JPG'] as FileType[]).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            {selected.size > 0 && (
              <>
                <div className="h-5 w-px bg-gray-200" />
                <span className="text-[12px] text-gray-500">{selected.size} selected</span>
                <button onClick={() => notify(`Downloaded ${selected.size} file(s)`)}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-gray-900 text-white hover:bg-gray-700 transition-colors">
                  Download
                </button>
                <button onClick={() => { setSelected(new Set()); notify('Deleted selected files'); }}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors">
                  Delete
                </button>
              </>
            )}
          </div>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 px-1">
            <button onClick={() => setActiveFolder('all')}
              className="text-[12px] text-gray-400 hover:text-gray-700">All Documents</button>
            {activeFolder !== 'all' && (
              <>
                <span className="text-gray-300">/</span>
                <span className="text-[12px] font-semibold text-gray-700">{folderLabel}</span>
              </>
            )}
            <span className="text-[11px] text-gray-400 ml-2">— {filtered.length} files</span>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #f3f4f6', background: '#fafafa' }}>
                  <th className="pl-4 pr-2 py-3 w-8">
                    <input type="checkbox"
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onChange={(e) => setSelected(e.target.checked ? new Set(filtered.map((f) => f.id)) : new Set())}
                      className="rounded border-gray-300 cursor-pointer" />
                  </th>
                  {['File Name', 'Folder', 'Uploaded By', 'Date', 'Type', 'Size', 'Actions'].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <div className="text-[28px] mb-2">📭</div>
                      <p className="text-[13px] font-semibold text-gray-500">No documents found</p>
                      <p className="text-[12px] text-gray-400 mt-1">Try changing the search or filter.</p>
                    </td>
                  </tr>
                ) : filtered.map((file) => {
                  const tc = TYPE_CONFIG[file.type];
                  const isSelected = selected.has(file.id);
                  const folderName = FOLDERS.find((f) => f.id === file.folder)?.label ?? '';
                  return (
                    <tr key={file.id} className="group transition-colors"
                      style={{ background: isSelected ? '#f9fafb' : 'transparent' }}
                      onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#fafafa'; }}
                      onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                      <td className="pl-4 pr-2 py-3">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(file.id)}
                          className="rounded border-gray-300 cursor-pointer" />
                      </td>

                      {/* File name */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[16px]"
                            style={{ background: tc.bg }}>
                            <FileIcon />
                          </div>
                          <div>
                            <p className="text-[12.5px] font-semibold text-gray-900 leading-snug max-w-[200px] truncate"
                              title={file.name}>{file.name}</p>
                          </div>
                        </div>
                      </td>

                      {/* Folder */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <FolderIcon />
                          <span className="text-[12px] text-gray-500 truncate max-w-[120px]" title={folderName}>
                            {folderName}
                          </span>
                        </div>
                      </td>

                      {/* Uploaded by */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0">
                            <span className="text-[9px] font-bold text-white">
                              {file.uploadedBy.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                            </span>
                          </div>
                          <span className="text-[12px] text-gray-600">{file.uploadedBy}</span>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="px-3 py-3">
                        <span className="text-[12px] text-gray-500 font-mono">{file.date}</span>
                      </td>

                      {/* Type badge */}
                      <td className="px-3 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded text-[10.5px] font-bold tracking-wider"
                          style={{ background: tc.bg, color: tc.text }}>
                          {file.type}
                        </span>
                      </td>

                      {/* Size */}
                      <td className="px-3 py-3">
                        <span className="text-[12px] text-gray-500 tabular-nums">{file.size}</span>
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ActionBtn label="Download" onClick={() => notify(`Downloading ${file.name}…`)} />
                          <ActionBtn label="Rename"   onClick={() => notify(`Rename: ${file.name}`)} />
                          <ActionBtn label="Move"     onClick={() => notify(`Move: ${file.name}`)} />
                          <button onClick={() => notify(`Deleted: ${file.name}`)}
                            className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Footer */}
            {filtered.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between"
                style={{ background: '#fafafa' }}>
                <span className="text-[11.5px] text-gray-400">
                  Showing {filtered.length} of 248 documents
                </span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, '…', 10].map((p, i) => (
                    <button key={i}
                      className="w-7 h-7 rounded text-[12px] font-medium transition-colors"
                      style={{
                        background: p === 1 ? '#111111' : '#f3f4f6',
                        color:      p === 1 ? '#ffffff'  : '#6b7280',
                      }}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Tiny action button ─────────────────────────────────────── */
function ActionBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="px-2 py-1 rounded text-[11px] font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors whitespace-nowrap">
      {label}
    </button>
  );
}
