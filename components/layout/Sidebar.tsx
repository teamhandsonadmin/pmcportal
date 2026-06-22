'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/* ─── Icons ────────────────────────────────────────────────── */
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
  Dashboard:      () => <Ico d={['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z']} extra={<polyline points="9 22 9 12 15 12 15 22"/>} />,
  Projects:       () => <Ico d={['M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z']} />,
  Tasks:          () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  Dependencies:   () => <Ico d={['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71']} />,
  Calendar:       () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
      <path d="M8 14h.01M12 14h.01M16 14h.01"/>
    </svg>
  ),
  Attendance:     () => <Ico d={['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75']} />,
  DPR:            () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  Photos:         () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  ),
  Documents:      () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
    </svg>
  ),
  Issues:         () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  Access:         () => <Ico d={['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z']} />,
  Reports:        () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/><path d="M2 20h20"/>
    </svg>
  ),
  Health:         () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  Scorecards:     () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  Notifications:  () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  Settings:       () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  Collapse:       () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6"/>
    </svg>
  ),
  Expand:         () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6"/>
    </svg>
  ),
  Logout:         () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
};

/* ─── Nav structure ─────────────────────────────────────────── */
const PINNED = [
  { label: 'Critical Alerts', href: '/alerts', icon: Icons.Notifications, exact: false, badge: 6 },
];

const SECTIONS = [
  {
    label: 'Workspace',
    items: [
      { label: 'Dashboard',               href: '/projects',    icon: Icons.Dashboard,     exact: true,  badge: 0 },
      { label: 'Tasks & Works',           href: '/works',       icon: Icons.Tasks,         exact: false, badge: 0 },
      { label: 'Dependencies',            href: '/hvac',        icon: Icons.Dependencies,  exact: false, badge: 0 },
      { label: 'Schedule & Calendar',     href: '/calendar',    icon: Icons.Calendar,      exact: false, badge: 0 },
      { label: 'Attendance',              href: '/attendance',  icon: Icons.Attendance,    exact: false, badge: 0 },
      { label: 'Daily Progress Reports',  href: '/dpr',         icon: Icons.DPR,           exact: false, badge: 0 },
      { label: 'Site Photos',             href: '/photos',      icon: Icons.Photos,        exact: false, badge: 0 },
      { label: 'Documents',               href: '/documents',   icon: Icons.Documents,     exact: false, badge: 0 },
    ],
  },
  {
    label: 'Management',
    items: [
      { label: 'Access & Roles',   href: '/access',         icon: Icons.Access,      exact: false, badge: 0 },
      { label: 'Reports',          href: '/reports',        icon: Icons.Reports,     exact: false, badge: 0 },
      { label: 'Project Health',   href: '/project-health', icon: Icons.Health,      exact: true,  badge: 0 },
      { label: 'Score Cards',      href: '/scorecards',     icon: Icons.Scorecards,  exact: false, badge: 0 },
    ],
  },
  {
    label: 'Admin',
    items: [
      { label: 'Settings', href: '/settings', icon: Icons.Settings, exact: false, badge: 0, disabled: true },
    ],
  },
];

/* ─── NavItem ────────────────────────────────────────────────── */
function NavItem({
  item, collapsed, pathname,
}: {
  item: { label: string; href: string; activeHref?: string; icon: () => React.JSX.Element; exact: boolean; badge?: number; disabled?: boolean };
  collapsed: boolean;
  pathname: string;
}) {
  const checkHref = item.activeHref ?? item.href;
  const active = item.exact
    ? pathname === checkHref
    : pathname.startsWith(checkHref);
  const hasBadge = (item.badge ?? 0) > 0;
  const disabled = item.disabled ?? false;

  const inner = (
    <div
      className="flex items-center rounded-md transition-colors duration-100"
      style={{
        gap:            collapsed ? 0 : '9px',
        padding:        collapsed ? '9px 0' : '8px 10px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        background:     active && !disabled ? '#111111' : 'transparent',
        color:          disabled ? '#d1d5db' : active ? '#ffffff' : '#4b5563',
        cursor:         disabled ? 'not-allowed' : 'pointer',
        opacity:        disabled ? 0.55 : 1,
      }}
      onMouseEnter={(e) => {
        if (!active && !disabled) {
          (e.currentTarget as HTMLElement).style.background = '#f3f4f6';
          (e.currentTarget as HTMLElement).style.color = '#111111';
        }
      }}
      onMouseLeave={(e) => {
        if (!active && !disabled) {
          (e.currentTarget as HTMLElement).style.background = 'transparent';
          (e.currentTarget as HTMLElement).style.color = '#4b5563';
        }
      }}
    >
      <span className="flex-shrink-0 relative">
        <item.icon />
        {hasBadge && collapsed && (
          <span
            className="sidebar-badge-shake"
            style={{
              position: 'absolute', top: '-5px', right: '-5px',
              background: '#ef4444', color: '#fff',
              fontSize: '9px', fontWeight: 800, lineHeight: 1,
              minWidth: '14px', height: '14px',
              borderRadius: '99px', padding: '0 3.5px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1.5px solid #fff',
            }}>
            {item.badge}
          </span>
        )}
      </span>
      {!collapsed && (
        <>
          <span className="text-[12.5px] font-medium leading-none truncate flex-1">{item.label}</span>
          {disabled && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 tracking-wide">
              SOON
            </span>
          )}
          {hasBadge && !disabled && (
            <span
              className="sidebar-badge-shake"
              style={{
                background: '#ef4444', color: '#fff',
                fontSize: '10px', fontWeight: 800, lineHeight: 1,
                minWidth: '18px', height: '18px',
                borderRadius: '99px', padding: '0 5px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                {item.badge}
              </span>
            )}
          </>
        )}
      </div>
  );

  if (disabled) return <div title={collapsed ? item.label : undefined}>{inner}</div>;
  return <Link href={item.href} title={collapsed ? item.label : undefined}>{inner}</Link>;
}

/* ─── Sidebar ────────────────────────────────────────────────── */
interface SidebarProps { collapsed: boolean; onToggle: () => void }

const SHAKE_CSS = `
@keyframes sidebar-shake {
  0%,100% { transform: translateX(0) rotate(0deg); }
  10%      { transform: translateX(-2px) rotate(-6deg); }
  20%      { transform: translateX(2px) rotate(6deg); }
  30%      { transform: translateX(-2px) rotate(-4deg); }
  40%      { transform: translateX(2px) rotate(4deg); }
  50%      { transform: translateX(-1px) rotate(-2deg); }
  60%      { transform: translateX(1px) rotate(2deg); }
  70%      { transform: translateX(0); }
}
.sidebar-badge-shake {
  animation: sidebar-shake 1.4s ease-in-out infinite;
  transform-origin: center;
}
`;

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className="fixed left-0 top-0 h-screen flex flex-col z-40 select-none transition-all duration-300"
      style={{
        width:       collapsed ? '52px' : '232px',
        background:  '#ffffff',
        borderRight: '1px solid #e5e7eb',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: SHAKE_CSS }} />
      {/* ── Logo bar (black) ─────────────────────────────── */}
      <div
        className="flex items-center justify-between flex-shrink-0 px-3"
        style={{ height: '52px', background: '#111111', borderBottom: '1px solid #1a1a1a' }}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M9 21V11h6v10"/>
            </svg>
          </div>
          {!collapsed && (
            <span className="text-[13px] font-bold text-white tracking-tight whitespace-nowrap">
              Work Portal
            </span>
          )}
        </div>
        <button
          onClick={onToggle}
          className="w-6 h-6 rounded flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <Icons.Expand /> : <Icons.Collapse />}
        </button>
      </div>

      {/* ── Nav ─────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden" style={{ padding: collapsed ? '6px 4px' : '6px 7px' }}>

        {/* ── Pinned: Critical Alerts ──────────────────── */}
        <div style={{ padding: collapsed ? '4px 0 2px' : '4px 0 2px' }}>
          {!collapsed && (
            <div className="px-2 pt-2 pb-1.5">
              <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-gray-400">Pinned</span>
            </div>
          )}
          {collapsed && <div className="h-px bg-gray-100 mb-2 mx-1" />}
          <div className="space-y-0.5">
            {PINNED.map((item) => (
              <NavItem key={item.href} item={item} collapsed={collapsed} pathname={pathname} />
            ))}
          </div>
        </div>

        <div className="h-px bg-gray-100 my-2 mx-1" />

        {SECTIONS.map((section, si) => (
          <div key={section.label} className={si > 0 ? 'mt-3' : ''}>
            {/* Section label */}
            {!collapsed ? (
              <div className="px-2 pt-3 pb-1.5">
                <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-gray-400">
                  {section.label}
                </span>
              </div>
            ) : (
              si > 0 && <div className="h-px bg-gray-100 my-2 mx-1" />
            )}

            {/* Items */}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavItem key={item.href + item.label} item={item} collapsed={collapsed} pathname={pathname} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Logout ──────────────────────────────────────── */}
      <div
        className="flex-shrink-0"
        style={{ borderTop: '1px solid #e5e7eb', padding: collapsed ? '8px 4px' : '8px 7px' }}
      >
        <button
          className="flex items-center rounded-md w-full transition-colors duration-100"
          style={{
            gap:            collapsed ? 0 : '9px',
            padding:        collapsed ? '9px 0' : '8px 10px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            color:          '#9ca3af',
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
