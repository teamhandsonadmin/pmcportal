import { redirect } from 'next/navigation';
import { getCurrentClientProfile } from '@/lib/auth/current-client';
import { getOrCreateDraftSequence } from '@/app/actions/draft-sequence';
import { DraftCanvas } from '@/components/client/DraftCanvas';

export const dynamic = 'force-dynamic';

export default async function ClientSequencePage() {
  const profile = await getCurrentClientProfile();
  if (!profile) redirect('/login');

  const result = await getOrCreateDraftSequence(profile.clientProjectId);
  if (!result.success || !result.data) redirect('/login');

  return <DraftCanvas draft={result.data} />;
}
