'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/* ─── Icons ─────────────────────────────────────────────────── */
function Ico({ d, extra }: { d: string | string[]; extra?: React.ReactNode }) {
  const paths = Array.isArray(d) ? d : [d];
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
      {paths.map((p, i) => <path key={i} d={p} />)}
      {extra}
    </svg>
  );
}

const Icons = {
  Works: () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  DPR: () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  Alerts: () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  Collapse: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6"/>
    </svg>
  ),
  Expand: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6"/>
    </svg>
  ),
  Logout: () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  Bell: () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  Search: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  ),
  Chevron: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6"/>
    </svg>
  ),
};

const SE_NAV = [
  { label: 'All Works',             href: '/site-engineer/works',  Icon: Icons.Works,  badge: 0 },
  { label: 'Daily Progress Report', href: '/site-engineer/dpr',    Icon: Icons.DPR,    badge: 0 },
  { label: 'My Alerts',             href: '/site-engineer/alerts', Icon: Icons.Alerts, badge: 3 },
];

/* ─── NavItem ────────────────────────────────────────────────── */
function NavItem({ item, collapsed, pathname }: {
  item: typeof SE_NAV[0]; collapsed: boolean; pathname: string;
}) {
  const active = pathname.startsWith(item.href);
  const hasBadge = item.badge > 0;

  return (
    <Link href={item.href}>
      <div
        className="flex items-center rounded-md transition-colors duration-100"
        style={{
          gap:            collapsed ? 0 : '9px',
          padding:        collapsed ? '9px 0' : '8px 10px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          background:     active ? '#111111' : 'transparent',
          color:          active ? '#ffffff' : '#4b5563',
        }}
        onMouseEnter={(e) => {
          if (!active) {
            (e.currentTarget as HTMLElement).style.background = '#f3f4f6';
            (e.currentTarget as HTMLElement).style.color = '#111111';
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = '#4b5563';
          }
        }}
      >
        <span className="flex-shrink-0 relative">
          <item.Icon />
          {hasBadge && collapsed && (
            <span style={{
              position: 'absolute', top: '-5px', right: '-5px',
              background: '#ef4444', color: '#fff',
              fontSize: '9px', fontWeight: 800, lineHeight: 1,
              minWidth: '14px', height: '14px',
              borderRadius: '99px', padding: '0 3.5px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1.5px solid #fff',
            }}>{item.badge}</span>
          )}
        </span>
        {!collapsed && (
          <>
            <span className="text-[12.5px] font-medium leading-none truncate flex-1">{item.label}</span>
            {hasBadge && (
              <span style={{
                background: '#ef4444', color: '#fff',
                fontSize: '10px', fontWeight: 800, lineHeight: 1,
                minWidth: '18px', height: '18px',
                borderRadius: '99px', padding: '0 5px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>{item.badge}</span>
            )}
          </>
        )}
      </div>
    </Link>
  );
}

/* ─── Sidebar ────────────────────────────────────────────────── */
function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();

  return (
    <aside
      className="fixed left-0 top-0 h-screen flex flex-col z-40 select-none transition-all duration-300"
      style={{ width: collapsed ? '52px' : '232px', background: '#ffffff', borderRight: '1px solid #e5e7eb' }}
    >
      {/* Logo bar */}
      <div className="flex items-center justify-between flex-shrink-0 px-3"
        style={{ height: '52px', background: '#111111', borderBottom: '1px solid #1a1a1a' }}>
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.12)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M9 21V11h6v10"/>
            </svg>
          </div>
          {!collapsed && (
            <div>
              <div className="text-[12.5px] font-bold text-white tracking-tight leading-tight">Work Portal</div>
              <div className="text-[9.5px] text-white/40 font-medium leading-tight">Site Engineer</div>
            </div>
          )}
        </div>
        <button onClick={onToggle}
          className="w-6 h-6 rounded flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
          title={collapsed ? 'Expand' : 'Collapse'}>
          {collapsed ? <Icons.Expand /> : <Icons.Collapse />}
        </button>
      </div>

      {/* Role badge (expanded only) */}
      {!collapsed && (
        <div className="px-3 py-2.5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">KS</div>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-gray-900 leading-tight truncate">Kumar S</div>
              <div className="text-[10px] text-gray-400 leading-tight truncate">Site Engineer</div>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden" style={{ padding: collapsed ? '6px 4px' : '6px 7px' }}>
        <div className="space-y-0.5 pt-1">
          {SE_NAV.map((item) => (
            <NavItem key={item.href} item={item} collapsed={collapsed} pathname={pathname} />
          ))}
        </div>
      </nav>

      {/* Logout */}
      <div className="flex-shrink-0" style={{ borderTop: '1px solid #e5e7eb', padding: collapsed ? '8px 4px' : '8px 7px' }}>
        <button
          className="flex items-center rounded-md w-full transition-colors duration-100"
          style={{
            gap: collapsed ? 0 : '9px',
            padding: collapsed ? '9px 0' : '8px 10px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: '#9ca3af',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = '#ef4444';
            (e.currentTarget as HTMLElement).style.background = '#fef2f2';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = '#9ca3af';
            (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
          title={collapsed ? 'Log out' : undefined}
        >
          <Icons.Logout />
          {!collapsed && <span className="text-[12.5px] font-medium leading-none">Log out</span>}
        </button>
      </div>
    </aside>
  );
}

/* ─── Header ─────────────────────────────────────────────────── */
function Header() {
  return (
    <header className="h-[52px] bg-card border-b border-border flex items-center gap-4 px-6 sticky top-0 z-30">
      {/* Search */}
      <div className="flex-1 max-w-md">
        <label className="flex items-center gap-2.5 bg-muted/60 border border-border rounded-lg px-3 h-9 cursor-text hover:border-gray-300 transition-colors">
          <Icons.Search />
          <input type="text" placeholder="Search tasks…"
            className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground outline-none border-none" />
        </label>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Alerts bell */}
        <button className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-muted transition-colors relative">
          <Icons.Bell />
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-[3px] leading-none">3</span>
        </button>
        <div className="w-px h-6 bg-border mx-1" />
        {/* User */}
        <div className="flex items-center gap-3 cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0">KS</div>
          <div className="hidden sm:block">
            <div className="text-[13px] font-semibold text-foreground leading-tight">Kumar S</div>
            <div className="text-[11px] text-muted-foreground leading-tight">siteengineer.demo@gmail.com</div>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ─── Layout ─────────────────────────────────────────────────── */
export function SiteEngineerSidebarLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('se-sidebar-collapsed');
    if (saved === 'true') setCollapsed(true);
  }, []);

  function toggle() {
    setCollapsed((c) => {
      localStorage.setItem('se-sidebar-collapsed', String(!c));
      return !c;
    });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className="flex-1 flex flex-col min-h-screen transition-all duration-300"
        style={{ marginLeft: collapsed ? '52px' : '232px' }}>
        <Header />
        <main className="flex-1 p-7">{children}</main>
      </div>
    </div>
  );
}
