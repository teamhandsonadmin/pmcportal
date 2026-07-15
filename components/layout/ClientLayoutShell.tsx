'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface ClientLayoutShellProps {
  projectName: string;
  children: React.ReactNode;
}

// Deliberately minimal — a thin header instead of the full admin sidebar,
// since a Miro-style canvas wants the screen, not a nav rail eating into it.
export function ClientLayoutShell({ projectName, children }: ClientLayoutShellProps) {
  const router = useRouter();

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
            <p className="text-[10.5px] text-muted-foreground leading-tight">Task Sequence Draft</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="text-[12.5px] font-medium text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        >
          Log out
        </button>
      </header>
      <main className="flex-1 min-h-0">{children}</main>
    </div>
  );
}
