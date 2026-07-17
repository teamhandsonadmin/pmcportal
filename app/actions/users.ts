'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import type { ActionResult } from '@/lib/types/hvac';

const CreateUserSchema = z.object({
  fullName: z.string().min(2).max(100),
  email:    z.string().email(),
  phone:    z.string().max(20).optional().nullable(),
  role:     z.enum(['senior_site_engineer', 'site_engineer']),
});

export async function getAssignableUsers() {
  return prisma.userProfile.findMany({
    where: { role: { in: ['site_engineer', 'senior_site_engineer'] }, status: 'active' },
    select: { id: true, fullName: true, role: true },
    orderBy: { fullName: 'asc' },
  });
}

export async function createUser(_prev: unknown, formData: FormData) {
  const raw = {
    fullName: formData.get('fullName'),
    email:    formData.get('email'),
    phone:    formData.get('phone') || null,
    role:     formData.get('role'),
  };
  const parsed = CreateUserSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Validation failed' };
  }
  try {
    const user = await prisma.userProfile.create({
      data: {
        fullName: parsed.data.fullName,
        email:    parsed.data.email,
        phone:    parsed.data.phone ?? null,
        role:     parsed.data.role,
        status:   'invited',
        isActive: false,
      },
    });
    revalidatePath('/access');
    return { success: true as const, userId: user.id };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('unique') || msg.includes('Unique')) {
      return { success: false as const, error: 'A user with this email already exists.' };
    }
    return { success: false as const, error: 'Failed to create user. Please try again.' };
  }
}

export async function updateUserRole(userId: string, role: 'admin' | 'senior_site_engineer' | 'site_engineer') {
  await prisma.userProfile.update({ where: { id: userId }, data: { role } });
  revalidatePath('/access');
  return { success: true };
}

export async function updateUserStatus(userId: string, status: 'active' | 'invited' | 'disabled') {
  await prisma.userProfile.update({
    where: { id: userId },
    data: { status, isActive: status === 'active' },
  });
  revalidatePath('/access');
  return { success: true };
}

export async function deleteUser(userId: string) {
  await prisma.userProfile.delete({ where: { id: userId } });
  revalidatePath('/access');
  return { success: true };
}

// Clears the mobile app's single-device login lock — the account's NEXT
// successful login (from any device, via the device-locked-login Edge
// Function) establishes a fresh lock to whichever device that was. Logged
// to ActivityLog since this is otherwise invisible/unaudited: without a
// trail here, nobody could tell a lockout was ever deliberately cleared
// vs. never having been set.
export async function resetDeviceLock(userId: string): Promise<ActionResult> {
  try {
    const user = await prisma.userProfile.update({
      where: { id: userId },
      data: { lockedDeviceId: null, lockedDeviceRegisteredAt: null },
    });
    await prisma.activityLog.create({
      data: { userId, actionType: 'user_device_lock_reset', payload: { email: user.email } },
    });
  } catch {
    return { success: false, error: 'Failed to reset device lock' };
  }
  revalidatePath('/access');
  return { success: true };
}

// Shared by forceLogoutUser and blockUser — see forceLogoutUser's own
// comment for why this reaches directly into Supabase Auth's own
// auth.sessions/auth.refresh_tokens tables instead of supabase-js's
// admin.signOut() (which needs a JWT you already have, not a user id).
//
// Deferred behind a short buffer via Next's after() rather than run inline
// — confirmed via a live test that killing the session with no gap after
// the triggering DB write can race ahead of Realtime's own delivery
// latency and prevent the fast kill-switch from ever reaching the device
// at all (a real bug caught in testing, not a hypothetical). ~500ms was
// enough headroom in testing; 2s is kept as safety margin. Runs via
// after() so the admin gets an immediate response instead of waiting out
// the buffer themselves.
function scheduleSessionRevocation(email: string) {
  after(async () => {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    try {
      const authUsers = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `select id::text from auth.users where email = $1`,
        email
      );
      const authUserId = authUsers[0]?.id;
      if (authUserId) {
        await prisma.$executeRawUnsafe(`delete from auth.refresh_tokens where user_id = $1`, authUserId);
        await prisma.$executeRawUnsafe(`delete from auth.sessions where user_id = $1::uuid`, authUserId);
      }
    } catch (err) {
      console.error('[scheduleSessionRevocation] deferred session revocation failed:', err);
    }
  });
}

// Ends a user's current mobile session as close to immediately as this
// stack allows — two layers, matching the actual constraint this was
// designed against:
//   1. forceLogoutAt is the fast layer: the mobile app itself watches its
//      own profile row (Realtime + a polling fallback, see
//      lib/forceLogoutWatch.ts) and signs out within seconds of noticing
//      this timestamp is newer than its current session's start.
//   2. scheduleSessionRevocation() above is the backstop for a phone
//      that's offline right now and only reconnects later — an access
//      token already issued keeps working until it naturally expires
//      either way (that's a stateless-JWT property, not something this
//      fixes), but no NEW one can ever be silently minted after this.
//
// Deliberately does NOT touch lockedDeviceId — ending a session and
// resetting which device an account may log in from are two different
// situations (see resetDeviceLock's own comment); a stolen phone needs
// both actions taken separately, not bundled into one.
export async function forceLogoutUser(userId: string): Promise<ActionResult> {
  const user = await prisma.userProfile.findUnique({ where: { id: userId } });
  if (!user) return { success: false, error: 'User not found' };

  try {
    await prisma.userProfile.update({ where: { id: userId }, data: { forceLogoutAt: new Date() } });
    await prisma.activityLog.create({
      data: { userId, actionType: 'user_force_logged_out', payload: { email: user.email } },
    });
  } catch {
    return { success: false, error: 'Failed to force logout' };
  }

  scheduleSessionRevocation(user.email);
  revalidatePath('/access');
  return { success: true };
}

// Blocks the account outright — reuses the existing UserStatus.disabled
// value (no separate "blocked" flag) AND ends their CURRENT session the
// same way forceLogoutUser does: a blocked user whose existing session
// just keeps working until it naturally expires isn't actually blocked in
// any way that matters for the departing-employee/stolen-phone scenarios
// this is for. Future login attempts are separately rejected server-side
// by the device-locked-login Edge Function's status check (see its own
// comment — that check used to run client-side only, after a session was
// already issued; it's now enforced before any token is ever handed back).
export async function blockUser(userId: string): Promise<ActionResult> {
  const user = await prisma.userProfile.findUnique({ where: { id: userId } });
  if (!user) return { success: false, error: 'User not found' };

  try {
    await prisma.userProfile.update({
      where: { id: userId },
      data: { status: 'disabled', isActive: false, forceLogoutAt: new Date() },
    });
    await prisma.activityLog.create({
      data: { userId, actionType: 'user_blocked', payload: { email: user.email } },
    });
  } catch {
    return { success: false, error: 'Failed to block user' };
  }

  scheduleSessionRevocation(user.email);
  revalidatePath('/access');
  return { success: true };
}

// A Block action with no way back is a real operational trap — this is
// the reverse: restores normal login ability, nothing else (it does not
// touch lockedDeviceId or forceLogoutAt, so if the device lock was never
// reset separately, whoever was previously locked to this account is
// still the only device that can log back in — consistent with reset and
// block/unblock being three independently deliberate actions, not aliases
// of each other).
export async function unblockUser(userId: string): Promise<ActionResult> {
  try {
    const user = await prisma.userProfile.update({
      where: { id: userId },
      data: { status: 'active', isActive: true },
    });
    await prisma.activityLog.create({
      data: { userId, actionType: 'user_unblocked', payload: { email: user.email } },
    });
  } catch {
    return { success: false, error: 'Failed to unblock user' };
  }
  revalidatePath('/access');
  return { success: true };
}

// Newest-first, capped at a reasonable page size — a long tail of old,
// already-understood attempts shouldn't push out what's actually new.
export async function getBlockedLoginAttempts() {
  const logs = await prisma.activityLog.findMany({
    where: { actionType: 'blocked_device_login' },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return logs.map((log) => {
    const payload = (log.payload ?? {}) as { email?: string; rejectedDeviceId?: string };
    return {
      id: log.id,
      email: payload.email ?? 'Unknown',
      rejectedDeviceId: payload.rejectedDeviceId ?? 'Unknown',
      createdAt: log.createdAt,
    };
  });
}
