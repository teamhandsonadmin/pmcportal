import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/projects');

  const { error } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-[380px]">

        {/* Brand mark */}
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M9 21V11h6v10"/>
            </svg>
          </div>
          <span className="text-[17px] font-semibold tracking-[-0.02em]">PMC Portal</span>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-8 card-shadow">
          <h1 className="text-[17px] font-semibold tracking-[-0.01em] mb-1">Sign in</h1>
          <p className="text-[13px] text-muted-foreground mb-6">Enter your credentials to continue</p>

          {error && (
            <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[12.5px] text-red-700 font-medium">
              {error}
            </div>
          )}

          <form action="/auth/callback" method="post" className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-[12.5px] font-medium text-foreground">Email</label>
              <input
                id="email" name="email" type="email" required
                placeholder="you@company.com"
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-[13px] text-foreground placeholder:text-muted-foreground/50 shadow-none transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-[12.5px] font-medium text-foreground">Password</label>
              <input
                id="password" name="password" type="password" required
                placeholder="••••••••"
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-[13px] text-foreground placeholder:text-muted-foreground/50 shadow-none transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center rounded-lg bg-foreground text-background h-9 px-4 text-[13px] font-semibold hover:opacity-85 transition-opacity mt-2"
            >
              Sign in
            </button>
          </form>
        </div>

        <p className="text-center text-[11.5px] text-muted-foreground/50 mt-5">
          Construction Workflow Management
        </p>
      </div>
    </div>
  );
}
