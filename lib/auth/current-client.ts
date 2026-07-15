import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export interface CurrentClientProfile {
  id: string;
  clientProjectId: string;
}

// Server-only. New pattern for this repo: every existing app/actions/*.ts
// file trusts caller-supplied IDs with no session check at all (see
// app/auth/callback/route.ts for the only other place this app resolves a
// Supabase session to a UserProfile row, there by email at login time, not
// per-request). The draft-sequence actions are the first to need real
// per-request identity, since a client must only ever touch their own
// project's draft — enforced here, not just by the UI never surfacing
// another project's draft ID.
export async function getCurrentClientProfile(): Promise<CurrentClientProfile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const profile = await prisma.userProfile.findUnique({
    where: { email: user.email },
    select: { id: true, role: true, clientProjectId: true },
  });
  if (!profile || profile.role !== 'client' || !profile.clientProjectId) return null;

  return { id: profile.id, clientProjectId: profile.clientProjectId };
}
