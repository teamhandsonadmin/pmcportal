import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export interface CurrentUserProfile {
  id: string;
  fullName: string;
  email: string;
}

// Broader than getCurrentAdminProfile/getCurrentClientProfile (any role, not
// just admin or client) — comment authorship just needs "whoever is
// actually signed in right now," not a role gate. Same session -> email ->
// UserProfile pattern as those two. Returns null if there's no session or no
// matching profile; callers treat that as an anonymous/unattributed comment
// rather than rejecting the write outright, since posting a comment isn't a
// privileged action the way sending a client report or touching a draft is.
export async function getCurrentUserProfile(): Promise<CurrentUserProfile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const profile = await prisma.userProfile.findUnique({
    where: { email: user.email },
    select: { id: true, fullName: true, email: true },
  });
  return profile ?? null;
}
