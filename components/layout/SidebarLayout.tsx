'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import type { CurrentUserProfile } from '@/lib/auth/current-user';

export function SidebarLayout({ children, currentUser }: { children: React.ReactNode; currentUser: CurrentUserProfile | null }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved === 'true') setCollapsed(true);
  }, []);

  function toggle() {
    setCollapsed((c) => {
      localStorage.setItem('sidebar-collapsed', String(!c));
      return !c;
    });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div
        className="flex-1 flex flex-col min-h-screen transition-all duration-300"
        style={{ marginLeft: collapsed ? '52px' : '232px' }}
      >
        <Header currentUser={currentUser} />
        <main className="flex-1 p-7">{children}</main>
      </div>
    </div>
  );
}
