import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentClientProfile } from '@/lib/auth/current-client';
import { ClientLayoutShell } from '@/components/layout/ClientLayoutShell';

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentClientProfile();
  if (!profile) redirect('/login');

  const project = await prisma.project.findUnique({
    where: { id: profile.clientProjectId },
    select: { name: true },
  });

  return <ClientLayoutShell projectName={project?.name ?? 'Your Project'}>{children}</ClientLayoutShell>;
}
