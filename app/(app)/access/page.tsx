import { prisma } from '@/lib/prisma';
import { AccessManagement } from '@/components/access/AccessManagement';

export const dynamic = 'force-dynamic';

async function getUsers() {
  try {
    return await prisma.userProfile.findMany({ orderBy: { createdAt: 'desc' } });
  } catch {
    return [];
  }
}

export default async function AccessPage() {
  const users = await getUsers();
  return (
    <AccessManagement
      initialUsers={users.map((u) => ({
        id:        u.id,
        fullName:  u.fullName,
        email:     u.email,
        phone:     u.phone,
        role:      u.role as 'admin' | 'senior_site_engineer' | 'site_engineer',
        status:    u.status as 'active' | 'invited' | 'disabled',
        isActive:  u.isActive,
        lastLogin: u.lastLogin,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      }))}
    />
  );
}
