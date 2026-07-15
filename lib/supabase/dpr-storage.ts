import { createAdminClient } from './admin';

// Server-only: uses the service-role key, which must never reach the client bundle.
// Only import this file from Server Actions / Server Components.

const BUCKET = 'dpr-photos';

// Idempotent: safe to call before every use. Private bucket — same
// convention as inventory-documents (see lib/supabase/admin.ts).
export async function ensureDprPhotosBucket() {
  const supabase = createAdminClient();
  const { data: existing } = await supabase.storage.getBucket(BUCKET);
  if (existing) return;

  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: '10MB',
    allowedMimeTypes: ['image/jpeg', 'image/png'],
  });
  if (error && !error.message.includes('already exists')) throw error;
}

// Generated fresh at render time, never persisted — the bucket is private
// and signed URLs expire, so storing one would eventually 404. Same
// approach as getSignedInvoiceUrl.
export async function getSignedDprPhotoUrl(path: string, expiresInSeconds = 3600): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}
