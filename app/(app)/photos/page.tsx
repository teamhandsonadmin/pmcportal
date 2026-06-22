'use client';

import { useState, useMemo } from 'react';

/* ─── Types & Config ──────────────────────────────────────────── */
type Category = 'Progress' | 'Before Work' | 'After Work' | 'Completion' | 'Inspection' | 'Material';
type Project  = 'ABC Villa';

const CAT_STYLE: Record<Category, { bg: string; text: string; border: string; accent: string }> = {
  'Progress':    { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE', accent: '#3B82F6' },
  'Before Work': { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE', accent: '#8B5CF6' },
  'After Work':  { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0', accent: '#22C55E' },
  'Completion':  { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0', accent: '#10B981' },
  'Inspection':  { bg: '#FFF7ED', text: '#9A3412', border: '#FED7AA', accent: '#F97316' },
  'Material':    { bg: '#FAF5FF', text: '#7C3AED', border: '#E9D5FF', accent: '#A855F7' },
};

const PROJECT_COLOR: Record<Project, string> = {
  'ABC Villa': '#111827',
};

/* Photo placeholder gradient palette — varied to make grid feel real */
const GRADIENTS = [
  ['#1e3a5f', '#2d5a8e'],  // deep blue
  ['#1a3a2a', '#2d6645'],  // deep green
  ['#3b1f0a', '#6b3a1a'],  // dark brown
  ['#1f1f3b', '#3b3b6b'],  // slate blue
  ['#2a1a0a', '#5a3a1a'],  // warm brown
  ['#0a2a1a', '#1a5a3a'],  // dark teal
  ['#2a0a0a', '#5a1a1a'],  // deep red
  ['#1a2a0a', '#3a5a1a'],  // olive
  ['#0a1a2a', '#1a3a5a'],  // navy
  ['#2a1a3b', '#5a3a6b'],  // purple
  ['#1a2a1a', '#3a5a3a'],  // forest
  ['#3b2a0a', '#6b4a1a'],  // amber
];

interface Photo {
  id: string; title: string; project: Project; category: Category;
  engineer: string; time: string; date: string;
  height: 'short' | 'medium' | 'tall';
  gradientIdx: number; comments: number; views: number;
}

const PHOTOS: Photo[] = [
  { id: 'p01', title: 'HVAC Duct Installation',        project: 'ABC Villa', category: 'Progress',    engineer: 'Kumar S',   time: '11:30 AM', date: '22 Jun', height: 'tall',   gradientIdx: 0,  comments: 3, views: 12 },
  { id: 'p02', title: 'Electrical Routing Progress',   project: 'ABC Villa', category: 'Progress',    engineer: 'Arjun K',   time: '2:30 PM',  date: '22 Jun', height: 'medium', gradientIdx: 1,  comments: 1, views: 8  },
  { id: 'p03', title: 'Final Ceiling Preparation',     project: 'ABC Villa', category: 'After Work',  engineer: 'Manoj R',   time: '5:30 PM',  date: '22 Jun', height: 'short',  gradientIdx: 2,  comments: 0, views: 5  },
  { id: 'p04', title: 'Site Before Plumbing',          project: 'ABC Villa', category: 'Before Work', engineer: 'Sanjay T',  time: '08:00 AM', date: '22 Jun', height: 'medium', gradientIdx: 3,  comments: 2, views: 14 },
  { id: 'p05', title: 'Slab Completion Level B2',      project: 'ABC Villa', category: 'Completion',  engineer: 'Kumar S',   time: '4:15 PM',  date: '22 Jun', height: 'tall',   gradientIdx: 4,  comments: 5, views: 21 },
  { id: 'p06', title: 'Steel Rebar Inspection',        project: 'ABC Villa', category: 'Inspection',  engineer: 'Ravi M',    time: '9:45 AM',  date: '22 Jun', height: 'short',  gradientIdx: 5,  comments: 1, views: 7  },
  { id: 'p07', title: 'Plumbing Rough-in Work',        project: 'ABC Villa', category: 'Progress',    engineer: 'Priya R',   time: '1:00 PM',  date: '22 Jun', height: 'medium', gradientIdx: 6,  comments: 0, views: 4  },
  { id: 'p08', title: 'Tile Material Delivery',        project: 'ABC Villa', category: 'Material',    engineer: 'Manoj R',   time: '10:30 AM', date: '22 Jun', height: 'tall',   gradientIdx: 7,  comments: 2, views: 9  },
  { id: 'p09', title: 'Formwork Ready for Concreting', project: 'ABC Villa', category: 'Before Work', engineer: 'Sanjay T',  time: '7:30 AM',  date: '21 Jun', height: 'short',  gradientIdx: 8,  comments: 1, views: 6  },
  { id: 'p10', title: 'Waterproofing Layer Applied',   project: 'ABC Villa', category: 'After Work',  engineer: 'Kumar S',   time: '3:45 PM',  date: '21 Jun', height: 'medium', gradientIdx: 9,  comments: 4, views: 18 },
  { id: 'p11', title: 'False Ceiling Frame Complete',  project: 'ABC Villa', category: 'Completion',  engineer: 'Arjun K',   time: '5:00 PM',  date: '21 Jun', height: 'tall',   gradientIdx: 10, comments: 2, views: 11 },
  { id: 'p12', title: 'Paint Material Inspection',     project: 'ABC Villa', category: 'Material',    engineer: 'Priya R',   time: '11:00 AM', date: '21 Jun', height: 'short',  gradientIdx: 11, comments: 0, views: 3  },
  { id: 'p13', title: 'CPVC Pipe Routing Progress',    project: 'ABC Villa', category: 'Progress',    engineer: 'Ravi M',    time: '2:00 PM',  date: '21 Jun', height: 'medium', gradientIdx: 0,  comments: 3, views: 15 },
  { id: 'p14', title: 'Electrical Panel Installed',    project: 'ABC Villa', category: 'Completion',  engineer: 'Arjun K',   time: '4:30 PM',  date: '21 Jun', height: 'tall',   gradientIdx: 1,  comments: 1, views: 8  },
  { id: 'p15', title: 'Site Cleared for Flooring',     project: 'ABC Villa', category: 'Before Work', engineer: 'Sanjay T',  time: '8:30 AM',  date: '20 Jun', height: 'short',  gradientIdx: 2,  comments: 0, views: 4  },
  { id: 'p16', title: 'Gypsum Ceiling Inspection',     project: 'ABC Villa', category: 'Inspection',  engineer: 'Ravi M',    time: '10:00 AM', date: '20 Jun', height: 'medium', gradientIdx: 3,  comments: 2, views: 10 },
];

/* ─── SVG scene for placeholder image ───────────────────────── */
function PhotoPlaceholder({ gradientIdx, category, height }: {
  gradientIdx: number; category: Category; height: 'short' | 'medium' | 'tall';
}) {
  const [g1, g2] = GRADIENTS[gradientIdx % GRADIENTS.length];
  const h = height === 'tall' ? 240 : height === 'medium' ? 180 : 130;
  const id = `g${gradientIdx}`;
  const accent = CAT_STYLE[category].accent;

  return (
    <svg width="100%" height={h} viewBox={`0 0 320 ${h}`} xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', borderRadius: '12px 12px 0 0' }}>
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={g1}/>
          <stop offset="100%" stopColor={g2}/>
        </linearGradient>
      </defs>
      <rect width="320" height={h} fill={`url(#${id})`} rx="12"/>

      {/* Grid lines to simulate construction site */}
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={`h${f}`} x1="0" y1={h * f} x2="320" y2={h * f} stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
      ))}
      {[0.2, 0.4, 0.6, 0.8].map((f) => (
        <line key={`v${f}`} x1={320 * f} y1="0" x2={320 * f} y2={h} stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
      ))}

      {/* Construction scaffolding shapes */}
      <rect x="60" y={h * 0.3} width="4" height={h * 0.7} fill="rgba(255,255,255,0.1)" rx="2"/>
      <rect x="260" y={h * 0.2} width="4" height={h * 0.8} fill="rgba(255,255,255,0.1)" rx="2"/>
      <rect x="60" y={h * 0.3} width="204" height="3" fill="rgba(255,255,255,0.1)" rx="2"/>
      <rect x="60" y={h * 0.55} width="204" height="3" fill="rgba(255,255,255,0.08)" rx="2"/>

      {/* Floor/ground */}
      <rect x="0" y={h * 0.88} width="320" height={h * 0.12} fill="rgba(0,0,0,0.2)"/>

      {/* Camera icon */}
      <g transform={`translate(${320/2 - 18}, ${h/2 - 18})`} opacity="0.35">
        <rect x="0" y="4" width="36" height="26" rx="4" fill="none" stroke="white" strokeWidth="2"/>
        <circle cx="18" cy="17" r="7" fill="none" stroke="white" strokeWidth="2"/>
        <rect x="12" y="0" width="12" height="5" rx="2" fill="none" stroke="white" strokeWidth="2"/>
      </g>

      {/* Accent bar top */}
      <rect x="0" y="0" width="320" height="3" fill={accent} opacity="0.8" rx="12"/>
    </svg>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function SitePhotosPage() {
  const [catFilter,   setCatFilter]   = useState<Category | 'All'>('All');
  const [projectFilter, setProjectFilter] = useState<Project | 'All'>('All');
  const [engineerFilter, setEngineerFilter] = useState<string>('All');
  const [dateFilter,  setDateFilter]  = useState<string>('All');
  const [search,      setSearch]      = useState('');
  const [lightbox,    setLightbox]    = useState<Photo | null>(null);
  const [notification, setNotification] = useState('');
  const [commentOpen, setCommentOpen] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  const engineers = ['All', ...Array.from(new Set(PHOTOS.map((p) => p.engineer)))];
  const dates     = ['All', ...Array.from(new Set(PHOTOS.map((p) => p.date)))];

  const filtered = useMemo(() => PHOTOS.filter((p) => {
    if (catFilter     !== 'All' && p.category !== catFilter)         return false;
    if (projectFilter !== 'All' && p.project  !== projectFilter)     return false;
    if (engineerFilter !== 'All' && p.engineer !== engineerFilter)   return false;
    if (dateFilter    !== 'All' && p.date     !== dateFilter)        return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase()) &&
        !p.engineer.toLowerCase().includes(search.toLowerCase()))     return false;
    return true;
  }), [catFilter, projectFilter, engineerFilter, dateFilter, search]);

  function notify(msg: string) {
    setNotification(msg);
    setTimeout(() => setNotification(''), 2500);
  }

  const categories: (Category | 'All')[] = ['All', 'Progress', 'Before Work', 'After Work', 'Completion', 'Inspection', 'Material'];
  const projects: (Project | 'All')[]    = ['All', 'ABC Villa'];

  return (
    <div className="space-y-5">

      {/* ── Toast ─────────────────────────────────────────── */}
      {notification && (
        <div className="fixed top-5 right-6 z-50 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-[13px] font-medium"
          style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.18)', zIndex: 9999 }}>
          {notification}
        </div>
      )}

      {/* ── Lightbox ──────────────────────────────────────── */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={() => setLightbox(null)}>
          <div className="bg-white rounded-2xl overflow-hidden w-full max-w-2xl mx-4"
            style={{ boxShadow: '0 32px 64px rgba(0,0,0,0.4)' }}
            onClick={(e) => e.stopPropagation()}>
            <PhotoPlaceholder gradientIdx={lightbox.gradientIdx} category={lightbox.category} height="tall" />
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-[16px] font-bold text-gray-900">{lightbox.title}</h3>
                  <p className="text-[12.5px] text-gray-500 mt-0.5">{lightbox.project} · {lightbox.date} at {lightbox.time}</p>
                </div>
                <button onClick={() => setLightbox(null)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors text-gray-500">
                  ✕
                </button>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <CatBadge c={lightbox.category} />
                <div className="flex items-center gap-2 ml-auto">
                  <BtnSm icon="⬇" label="Download" onClick={() => notify(`Downloading ${lightbox.title}`)} />
                  <BtnSm icon="💬" label={`${lightbox.comments} Comments`} onClick={() => { setLightbox(null); setCommentOpen(lightbox.id); }} />
                  <BtnPrimary label="Share" onClick={() => notify('Share link copied!')} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Comment panel ─────────────────────────────────── */}
      {commentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setCommentOpen(null)}>
          <div className="bg-white h-full w-full max-w-sm shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-[14px] font-bold text-gray-900">Comments</h3>
              <button onClick={() => setCommentOpen(null)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {[
                { author: 'Kumar S', time: '11:35 AM', text: 'Duct alignment confirmed with structural team.' },
                { author: 'Admin',   time: '12:00 PM', text: 'Please ensure insulation wrapping is done before next visit.' },
                { author: 'Priya R', time: '2:10 PM',  text: 'Noted. Will update after wrapping is complete.' },
              ].map((c, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0">
                    <span className="text-[9px] font-bold text-white">{c.author.split(' ').map((n) => n[0]).join('')}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[12px] font-semibold text-gray-900">{c.author}</span>
                      <span className="text-[10.5px] text-gray-400 font-mono">{c.time}</span>
                    </div>
                    <p className="text-[12.5px] text-gray-700 leading-snug">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-100">
              <div className="flex gap-2">
                <input value={commentText} onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment…"
                  className="flex-1 text-[13px] px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-gray-400 bg-gray-50" />
                <button onClick={() => { notify('Comment added'); setCommentText(''); }}
                  className="px-3 py-2 bg-gray-900 text-white rounded-lg text-[12px] font-semibold hover:bg-gray-700 transition-colors">
                  Post
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Site Photos</h1>
          <p className="text-[13.5px] text-gray-500 mt-1">Visual progress tracking for ABC Villa Construction.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button onClick={() => notify('Gallery view: Feature coming soon')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
            View Gallery
          </button>
          <button onClick={() => notify('Upload Photos: Feature coming soon')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-[13px] font-medium hover:bg-gray-800 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
            </svg>
            Upload Photos
          </button>
        </div>
      </div>

      {/* ── Summary Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Photos Uploaded Today', value: '48',  sub: 'Across 6 projects', icon: '📸', dot: '#3B82F6' },
          { label: 'Photos This Week',       value: '326', sub: '+18% from last week', icon: '📅', dot: '#10B981' },
          { label: 'Active Projects',         value: '18',  sub: 'Projects with uploads',icon: '🏗️', dot: '#F97316' },
          { label: 'Pending Reviews',         value: '6',   sub: 'Awaiting approval',   icon: '⏳', dot: '#EF4444' },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-5"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="flex items-start justify-between mb-3">
              <div className="text-[22px] leading-none">{c.icon}</div>
              <div className="w-2 h-2 rounded-full mt-1" style={{ background: c.dot }} />
            </div>
            <div className="text-[26px] font-extrabold text-gray-900 leading-none">{c.value}</div>
            <div className="text-[12px] font-semibold text-gray-700 mt-1.5">{c.label}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Category tabs ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-1.5 flex-wrap"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {categories.map((c) => {
          const active = catFilter === c;
          const style = c !== 'All' ? CAT_STYLE[c] : null;
          return (
            <button key={c} onClick={() => setCatFilter(c)}
              className="px-3.5 py-1.5 rounded-lg text-[12.5px] font-medium transition-all border"
              style={{
                background:  active ? (style?.accent ?? '#111111')  : style?.bg ?? '#f9fafb',
                color:       active ? '#ffffff'                       : style?.text ?? '#4b5563',
                borderColor: active ? 'transparent'                   : style?.border ?? '#e5e7eb',
              }}>
              {c === 'All' ? `📷 All Photos` :
               c === 'Progress'    ? `🔵 Progress` :
               c === 'Before Work' ? `🟣 Before Work` :
               c === 'After Work'  ? `🟢 After Work` :
               c === 'Completion'  ? `✅ Completion` :
               c === 'Inspection'  ? `🟠 Inspection` :
                                     `🟡 Material`}
            </button>
          );
        })}
        <span className="ml-auto text-[12px] text-gray-400">{filtered.length} photos</span>
      </div>

      {/* ── Filter + search bar ────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3 flex-wrap"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {/* Search */}
        <div className="flex items-center gap-2 flex-1 min-w-[180px] bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search photos or engineers…"
            className="flex-1 bg-transparent text-[12.5px] text-gray-700 placeholder-gray-400 outline-none" />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
          )}
        </div>

        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value as Project | 'All')}
          className="text-[12.5px] text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none">
          {projects.map((p) => <option key={p}>{p === 'All' ? 'All Projects' : p}</option>)}
        </select>

        <select value={engineerFilter} onChange={(e) => setEngineerFilter(e.target.value)}
          className="text-[12.5px] text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none">
          {engineers.map((e) => <option key={e}>{e === 'All' ? 'All Engineers' : e}</option>)}
        </select>

        <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
          className="text-[12.5px] text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none">
          {dates.map((d) => <option key={d}>{d === 'All' ? 'All Dates' : d}</option>)}
        </select>

        {(catFilter !== 'All' || projectFilter !== 'All' || engineerFilter !== 'All' || dateFilter !== 'All' || search) && (
          <button onClick={() => { setCatFilter('All'); setProjectFilter('All'); setEngineerFilter('All'); setDateFilter('All'); setSearch(''); }}
            className="px-3 py-2 rounded-lg text-[12px] font-medium text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors">
            Clear Filters
          </button>
        )}
      </div>

      {/* ── Masonry Gallery ───────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="text-[36px] mb-3">📷</div>
          <p className="text-[14px] font-semibold text-gray-600">No photos found</p>
          <p className="text-[12.5px] text-gray-400 mt-1">Try adjusting your filters or search term.</p>
        </div>
      ) : (
        <div className="columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-0" style={{ columnGap: '16px' }}>
          {filtered.map((photo) => (
            <PhotoCard key={photo.id} photo={photo}
              onView={() => setLightbox(photo)}
              onDownload={() => notify(`Downloading: ${photo.title}`)}
              onComment={() => setCommentOpen(photo.id)} />
          ))}
        </div>
      )}

      {/* ── Upload CTA ────────────────────────────────────── */}
      <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 py-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-all"
        onClick={() => notify('Upload Photos: Feature coming soon')}>
        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
          </svg>
        </div>
        <div className="text-center">
          <p className="text-[13.5px] font-semibold text-gray-700">Drop photos here or click to upload</p>
          <p className="text-[12px] text-gray-400 mt-0.5">PNG, JPG up to 50 MB each · Multiple files supported</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Photo Card ─────────────────────────────────────────────── */
function PhotoCard({ photo, onView, onDownload, onComment }: {
  photo: Photo;
  onView: () => void;
  onDownload: () => void;
  onComment: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const projColor = PROJECT_COLOR[photo.project];

  return (
    <div className="break-inside-avoid mb-4 bg-white rounded-xl border border-gray-200 overflow-hidden"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>

      {/* Image area */}
      <div className="relative" onClick={onView}>
        <PhotoPlaceholder gradientIdx={photo.gradientIdx} category={photo.category} height={photo.height} />

        {/* Hover overlay */}
        {hovered && (
          <div className="absolute inset-0 flex items-center justify-center rounded-t-xl"
            style={{ background: 'rgba(0,0,0,0.35)', borderRadius: '12px 12px 0 0' }}>
            <div className="flex items-center gap-2">
              <button onClick={(e) => { e.stopPropagation(); onView(); }}
                className="px-3 py-1.5 rounded-lg bg-white text-gray-900 text-[12px] font-semibold hover:bg-gray-100 transition-colors">
                View
              </button>
              <button onClick={(e) => { e.stopPropagation(); onDownload(); }}
                className="px-3 py-1.5 rounded-lg bg-white/20 text-white text-[12px] font-semibold hover:bg-white/30 transition-colors border border-white/30">
                ⬇
              </button>
            </div>
          </div>
        )}

        {/* Category badge top-left */}
        <div className="absolute top-2.5 left-2.5">
          <CatBadge c={photo.category} />
        </div>

        {/* Views top-right */}
        <div className="absolute top-2.5 right-2.5">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
            style={{ background: 'rgba(0,0,0,0.45)', color: '#fff' }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
            {photo.views}
          </span>
        </div>
      </div>

      {/* Meta */}
      <div className="px-3.5 py-3">
        <p className="text-[12.5px] font-bold text-gray-900 leading-snug mb-1.5 line-clamp-2">{photo.title}</p>

        {/* Project tag */}
        <div className="inline-flex items-center gap-1 mb-2.5">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: projColor }} />
          <span className="text-[11px] font-semibold" style={{ color: projColor }}>{photo.project}</span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0">
              <span className="text-[7.5px] font-bold text-white">
                {photo.engineer.split(' ').map((n) => n[0]).join('')}
              </span>
            </div>
            <div>
              <p className="text-[10.5px] font-semibold text-gray-700">{photo.engineer}</p>
              <p className="text-[10px] text-gray-400 font-mono">{photo.time} · {photo.date}</p>
            </div>
          </div>

          <button onClick={(e) => { e.stopPropagation(); onComment(); }}
            className="flex items-center gap-1 text-[10.5px] text-gray-400 hover:text-gray-700 transition-colors">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            {photo.comments}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Tiny helpers ───────────────────────────────────────────── */
function CatBadge({ c }: { c: Category }) {
  const s = CAT_STYLE[c];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold border"
      style={{ background: s.bg, color: s.text, borderColor: s.border }}>
      {c}
    </span>
  );
}

function BtnSm({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-[12px] font-medium text-gray-600 hover:bg-gray-100 transition-colors">
      {icon} {label}
    </button>
  );
}

function BtnPrimary({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-[12px] font-semibold hover:bg-gray-700 transition-colors">
      {label}
    </button>
  );
}
