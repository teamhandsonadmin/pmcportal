import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export interface CurrentAdminProfile {
  id: string;
}

// Mirrors lib/auth/current-client.ts's pattern exactly (session -> email ->
// UserProfile -> role check). No other admin-only server action in this
// repo checks role at all (see app/actions/users.ts's updateUserRole/
// updateUserStatus, which trust the caller entirely) — this is the first
// one that needs to, since sendReportToClient (app/actions/reports.ts)
// grants a client account real read access and shouldn't be triggerable by
// anyone who merely knows a projectId.
export async function getCurrentAdminProfile(): Promise<CurrentAdminProfile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const profile = await prisma.userProfile.findUnique({
    where: { email: user.email },
    select: { id: true, role: true },
  });
  if (!profile || profile.role !== 'admin') return null;

  return { id: profile.id };
}
