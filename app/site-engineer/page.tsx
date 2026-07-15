'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Replaces the old (site-engineer) route group, which was an unfinished web
// mockup with zero real functionality — the actual site-engineer experience
// is the separate Expo/React Native mobile app. This is deliberately a
// single, simple page (not a route group with its own layout/sidebar): there
// is no real web content for this role anymore, just a clear redirect-to-the-
// right-place message and a way out if someone lands here by mistake.
export default function SiteEngineerNoticePage() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-[380px] text-center">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M9 21V11h6v10" />
            </svg>
          </div>
          <span className="text-[17px] font-semibold tracking-[-0.02em]">PMC Portal</span>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 card-shadow">
          <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
              <rect x="5" y="2" width="14" height="20" rx="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
          </div>
          <h1 className="text-[17px] font-semibold tracking-[-0.01em] mb-1">Please use the mobile app</h1>
          <p className="text-[13px] text-muted-foreground leading-relaxed mb-6">
            Site engineer accounts don&apos;t have a web dashboard here. Attendance check-in/out and
            Daily Progress Reports are submitted from the PMC Portal mobile app on your phone.
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full inline-flex items-center justify-center rounded-lg bg-foreground text-background h-9 px-4 text-[13px] font-semibold hover:opacity-85 transition-opacity"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
