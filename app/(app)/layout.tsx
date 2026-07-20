import { SidebarLayout } from '@/components/layout/SidebarLayout';
import { getCurrentUserProfile } from '@/lib/auth/current-user';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const currentUser = await getCurrentUserProfile();
  return <SidebarLayout currentUser={currentUser}>{children}</SidebarLayout>;
}
