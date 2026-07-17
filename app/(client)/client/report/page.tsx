import { redirect } from 'next/navigation';
import { getCurrentClientProfile } from '@/lib/auth/current-client';
import { getProjectReportData } from '@/lib/data/report';
import { ClientProgressReport } from '@/components/reports/ClientProgressReport';

export const dynamic = 'force-dynamic';

export default async function ClientReportPage() {
  const profile = await getCurrentClientProfile();
  if (!profile) redirect('/login');

  const data = await getProjectReportData(profile.clientProjectId);
  // reportSentAt gates real access — an admin hasn't sent anything yet, so
  // there's nothing for this client to see (not a "not found", a "not yet").
  if (!data || !data.reportSentAt) redirect('/client/sequence');

  return <ClientProgressReport data={data} />;
}
