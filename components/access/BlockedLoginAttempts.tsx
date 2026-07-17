'use client';

import { useMemo, useState } from 'react';

export interface BlockedAttemptRow {
  id: string;
  email: string;
  fullName: string | null;
  rejectedDeviceId: string;
  createdAt: Date;
}

function fmtDateTime(d: Date) {
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function fmtRelative(d: Date, now: number) {
  const diff = now - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// A blocked attempt is deliberately a different, more interesting signal
// than a normal failed password — it means the password was CORRECT but
// the device wasn't. Two or more of these on the same account inside a
// day is the strongest version of that signal (someone actively trying
// from a second device, not a one-off old device swap), so it's called
// out rather than left to blend into a long list.
export function BlockedLoginAttempts({ attempts }: { attempts: BlockedAttemptRow[] }) {
  const [sortAsc, setSortAsc] = useState(false);
  // Captured once (lazy initializer, not a direct render-time call) rather
  // than calling Date.now() during render/memo — "recent enough" only
  // needs to be accurate as of when this list was loaded, not live-ticking.
  const [now] = useState(() => Date.now());

  const sorted = useMemo(() => {
    return [...attempts].sort((a, b) => {
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortAsc ? diff : -diff;
    });
  }, [attempts, sortAsc]);

  const burstEmails = useMemo(() => {
    const dayMs = 24 * 60 * 60 * 1000;
    const counts = new Map<string, number>();
    for (const a of attempts) {
      if (now - new Date(a.createdAt).getTime() < dayMs) {
        counts.set(a.email, (counts.get(a.email) ?? 0) + 1);
      }
    }
    return new Set([...counts.entries()].filter(([, n]) => n >= 2).map(([email]) => email));
  }, [attempts, now]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-100">
        <div>
          <h2 className="text-[15px] font-bold text-gray-900">Blocked Login Attempts</h2>
          <p className="text-[12.5px] text-gray-500 mt-0.5">
            A different device tried to sign in on an already-locked account — worth a look if it&apos;s recent or repeated.
          </p>
        </div>
        {attempts.length > 0 && (
          <button
            onClick={() => setSortAsc((s) => !s)}
            className="h-9 px-3 text-[12px] border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            {sortAsc ? 'Oldest first' : 'Newest first'}
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-[13px] text-gray-400">No blocked login attempts recorded.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50 max-h-[420px] overflow-y-auto">
          {sorted.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-gray-900 truncate">{a.fullName ?? a.email}</span>
                  {burstEmails.has(a.email) && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 flex-shrink-0">
                      Multiple in 24h
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-gray-400 truncate">{a.email}</div>
                <div className="text-[11px] text-gray-400 font-mono truncate mt-0.5">Device: {a.rejectedDeviceId}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-[12.5px] text-gray-600">{fmtRelative(a.createdAt, now)}</div>
                <div className="text-[11px] text-gray-400">{fmtDateTime(a.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
