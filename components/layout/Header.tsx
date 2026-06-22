'use client';

import { useState, useRef, useEffect } from 'react';

const DUMMY_NOTIFICATIONS = [
  { id: 1, title: 'Task moved to Ready',       body: 'HVAC-001 is ready to start — all dependencies cleared.',              time: '2m ago',   unread: true },
  { id: 2, title: 'Checklist item delivered',  body: 'Architect — Drawing & Design Approval marked as delivered.',          time: '45m ago',  unread: true },
  { id: 3, title: 'Task blocked',              body: 'HVAC-003 has been flagged as blocked awaiting client approval.',      time: '2h ago',   unread: true },
  { id: 4, title: 'New task created',          body: 'Level 5 Ductwork Installation was added to HVAC.',                   time: 'Yesterday', unread: false },
];

export function Header() {
  const [notifOpen, setNotifOpen]   = useState(false);
  const [notifications, setNotifications] = useState(DUMMY_NOTIFICATIONS);
  const notifRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter((n) => n.unread).length;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  }

  return (
    <header className="h-[56px] bg-card border-b border-border flex items-center gap-4 px-6 sticky top-0 z-30">

      {/* Search bar */}
      <div className="flex-1 max-w-md">
        <label className="flex items-center gap-2.5 bg-muted/60 border border-border rounded-lg px-3 h-9 cursor-text hover:border-gray-300 transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground flex-shrink-0">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Search tasks…"
            className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground outline-none border-none"
          />
          <kbd className="text-[10.5px] text-muted-foreground/60 bg-background border border-border rounded px-1.5 py-0.5 font-mono hidden sm:inline-flex items-center gap-0.5 flex-shrink-0">
            <span>⌘</span><span>F</span>
          </kbd>
        </label>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 ml-auto">

        {/* Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen((o) => !o)}
            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-muted transition-colors relative"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-gray-800 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-[3px] leading-none">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {notifOpen && (
            <div className="absolute right-0 top-11 w-[340px] bg-card rounded-xl border border-border shadow-lg overflow-hidden z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-bold text-white bg-gray-800 rounded-full px-1.5 py-px leading-none">
                      {unreadCount}
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-[11.5px] text-gray-500 hover:text-gray-900 hover:underline">
                    Mark all read
                  </button>
                )}
              </div>

              <div className="divide-y divide-border">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer hover:bg-muted/40 transition-colors ${n.unread ? 'bg-gray-50/60' : ''}`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className={`text-[12.5px] font-semibold truncate ${n.unread ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {n.title}
                        </span>
                        <span className="text-[10.5px] text-muted-foreground/60 flex-shrink-0">{n.time}</span>
                      </div>
                      <p className="text-[11.5px] text-muted-foreground leading-relaxed line-clamp-2">{n.body}</p>
                    </div>
                    {n.unread && <span className="w-1.5 h-1.5 bg-gray-700 rounded-full flex-shrink-0 mt-2" />}
                  </div>
                ))}
              </div>

              <div className="px-4 py-2.5 border-t border-border text-center">
                <button className="text-[12px] text-gray-500 hover:text-gray-900 hover:underline">View all notifications</button>
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-border mx-1" />

        {/* User profile */}
        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0">
            AD
          </div>
          <div className="hidden sm:block">
            <div className="text-[13px] font-semibold text-foreground leading-tight">Admin</div>
            <div className="text-[11px] text-muted-foreground leading-tight">teamhandsonadmin@gmail.com</div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50 hidden sm:block">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>
      </div>
    </header>
  );
}
