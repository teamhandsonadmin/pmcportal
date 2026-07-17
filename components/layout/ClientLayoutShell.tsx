'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface ClientLayoutShellProps {
  projectName: string;
  // Whether an admin has ever sent this client a progress report —
  // Project.reportSentAt is null until then. The tab only appearing once
  // real is the only genuine "you have something new" signal this app can
  // give the client today (see app/actions/reports.ts's own comment: no
  // email/push notification system exists yet to do this any other way).
  hasReport: boolean;
  children: React.ReactNode;
}

// Deliberately minimal — a thin header instead of the full admin sidebar,
// since a Miro-style canvas wants the screen, not a nav rail eating into it.
// The two-tab strip only appears once there's a second real page to switch
// to (hasReport) — a single-page client shouldn't see a tab bar with one tab.
export function ClientLayoutShell({ projectName, hasReport, children }: ClientLayoutShellProps) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="h-14 flex-shrink-0 border-b border-border flex items-center justify-between px-5 bg-card">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded bg-gray-900 flex items-center justify-center flex-shrink-0">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M9 21V11h6v10" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold leading-tight truncate">{projectName}</p>
            <p className="text-[10.5px] text-muted-foreground leading-tight">
              {hasReport ? 'Client Portal' : 'Task Sequence Draft'}
            </p>
          </div>
        </div>
        {hasReport && (
          <nav className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            <Link
              href="/client/sequence"
              className="px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors"
              style={{
                backgroundColor: pathname === '/client/sequence' ? '#111111' : 'transparent',
                color: pathname === '/client/sequence' ? '#ffffff' : '#6b7280',
              }}
            >
              Sequence
            </Link>
            <Link
              href="/client/report"
              className="px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors"
              style={{
                backgroundColor: pathname === '/client/report' ? '#111111' : 'transparent',
                color: pathname === '/client/report' ? '#ffffff' : '#6b7280',
              }}
            >
              Progress Report
            </Link>
          </nav>
        )}
        <button
          onClick={handleLogout}
          className="text-[12.5px] font-medium text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        >
          Log out
        </button>
      </header>
      <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
    </div>
  );
}
