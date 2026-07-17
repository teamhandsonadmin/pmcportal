import { prisma } from '@/lib/prisma';
import { AccessManagement } from '@/components/access/AccessManagement';
import { getBlockedLoginAttempts } from '@/app/actions/users';

export const dynamic = 'force-dynamic';

async function getUsers() {
  try {
    return await prisma.userProfile.findMany({ orderBy: { createdAt: 'desc' } });
  } catch {
    return [];
  }
}

export default async function AccessPage() {
  const [users, blockedAttempts] = await Promise.all([getUsers(), getBlockedLoginAttempts()]);

  // Enriched with a live full-name lookup rather than a name snapshot taken
  // at block-time, so a renamed/since-updated account still shows correctly.
  const nameByEmail = new Map(users.map((u) => [u.email, u.fullName]));

  return (
    <AccessManagement
      initialUsers={users.map((u) => ({
        id:        u.id,
        fullName:  u.fullName,
        email:     u.email,
        phone:     u.phone,
        role:      u.role as 'admin' | 'senior_site_engineer' | 'site_engineer' | 'client',
        status:    u.status as 'active' | 'invited' | 'disabled',
        isActive:  u.isActive,
        lastLogin: u.lastLogin,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        lockedDeviceId: u.lockedDeviceId,
        lockedDeviceRegisteredAt: u.lockedDeviceRegisteredAt,
      }))}
      blockedAttempts={blockedAttempts.map((a) => ({
        ...a,
        fullName: nameByEmail.get(a.email) ?? null,
      }))}
    />
  );
}
