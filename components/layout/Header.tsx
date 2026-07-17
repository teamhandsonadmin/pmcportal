'use client';

import { useState, useRef, useEffect } from 'react';
import { getNotificationsPanelData } from '@/app/actions/notifications';
import { STATUS_CHIP } from '@/components/hvac/StatusDropdown';
import type { NeedsAttentionItem, UpcomingTaskItem } from '@/lib/data/notifications';

type Tab = 'attention' | 'upcoming';

function NeedsAttentionRow({ item }: { item: NeedsAttentionItem }) {
  const chip = STATUS_CHIP[item.status];
  return (
    <div className={`flex items-start gap-3 px-4 py-3 border-l-2 ${item.isFlagged ? 'border-red-500 bg-red-50/40' : 'border-transparent'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="text-[12.5px] font-semibold text-foreground truncate">{item.taskName}</span>
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0"
            style={{ backgroundColor: chip.bg, color: chip.text }}
          >
            <span className="w-[5px] h-[5px] rounded-full flex-shrink-0" style={{ backgroundColor: chip.dot }} />
            {chip.label}
          </span>
        </div>
        <p className="text-[11.5px] text-muted-foreground truncate">{item.itemLabel}</p>
        <p className="text-[10.5px] text-muted-foreground/70 mt-0.5 truncate">{item.projectName} · {item.workName}</p>
      </div>
    </div>
  );
}

function UpcomingTaskRow({ item }: { item: UpcomingTaskItem }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="text-[12.5px] font-semibold text-foreground truncate">{item.taskName}</span>
          <span className="text-[10.5px] font-medium text-muted-foreground flex-shrink-0">{item.dateLabel}</span>
        </div>
        <p className="text-[10.5px] text-muted-foreground/70 truncate">{item.projectName} · {item.workName}</p>
      </div>
    </div>
  );
}

export function Header() {
  const [notifOpen, setNotifOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('attention');
  const [needsAttention, setNeedsAttention] = useState<NeedsAttentionItem[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const notifRef = useRef<HTMLDivElement>(null);

  const flagged = needsAttention.filter((i) => i.isFlagged);
  const needsResponse = needsAttention.filter((i) => !i.isFlagged);
  const totalCount = needsAttention.length + upcoming.length;

  async function load() {
    const data = await getNotificationsPanelData();
    setNeedsAttention(data.needsAttention);
    setUpcoming(data.upcoming);
  }

  useEffect(() => {
    // Initial mount fetch — no render-time value to derive this from
    // instead, matching GanttDetailPopup.tsx's identical, established
    // exception to this rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().finally(() => setLoading(false));
  }, []);

  // Refetch every time the dropdown is opened — reads live data rather than
  // whatever was fetched on mount, matching the "no caching that would show
  // stale status" requirement the checklist-health work established.
  function toggleOpen() {
    setNotifOpen((o) => {
      const next = !o;
      if (next) load();
      return next;
    });
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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
            onClick={toggleOpen}
            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-muted transition-colors relative"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {totalCount > 0 && (
              <span className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-[3px] leading-none ${flagged.length > 0 ? 'bg-red-600' : 'bg-gray-800'}`}>
                {totalCount > 99 ? '99+' : totalCount}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {notifOpen && (
            <div className="absolute right-0 top-11 w-[400px] bg-card rounded-xl border border-border shadow-lg overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-border">
                <span className="text-[13px] font-semibold">Notifications</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {needsResponse.length} needing a response · {flagged.length} flagged issue{flagged.length === 1 ? '' : 's'} · {upcoming.length} upcoming
                </p>
              </div>

              <div className="flex border-b border-border">
                {(['attention', 'upcoming'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`flex-1 px-3 py-2 text-[11.5px] font-semibold border-b-2 transition-colors ${
                      tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-muted-foreground hover:text-gray-700'
                    }`}
                  >
                    {t === 'attention' ? `Needs Attention (${needsAttention.length})` : `Upcoming (${upcoming.length})`}
                  </button>
                ))}
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {loading ? (
                  <p className="px-4 py-6 text-[12px] text-muted-foreground text-center">Loading…</p>
                ) : tab === 'attention' ? (
                  needsAttention.length === 0 ? (
                    <p className="px-4 py-6 text-[12px] text-muted-foreground text-center">Nothing needs attention.</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {flagged.map((item) => <NeedsAttentionRow key={item.itemId} item={item} />)}
                      {needsResponse.map((item) => <NeedsAttentionRow key={item.itemId} item={item} />)}
                    </div>
                  )
                ) : upcoming.length === 0 ? (
                  <p className="px-4 py-6 text-[12px] text-muted-foreground text-center">Nothing starting in the next 30 days.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {upcoming.map((item) => <UpcomingTaskRow key={item.id} item={item} />)}
                  </div>
                )}
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
