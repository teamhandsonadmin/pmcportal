import { createClient } from '@supabase/supabase-js';

// Server-only: uses the service-role key, which must never reach the client bundle.
// Only import this file from Server Actions / Server Components.

const BUCKET = 'inventory-documents';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Idempotent: safe to call before every upload. Private bucket — invoice images
// can contain supplier pricing/contact info, so we never make this public.
export async function ensureInventoryDocumentsBucket() {
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

export async function uploadInventoryDocument(path: string, buffer: Buffer, contentType: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType });
  if (error) throw error;
}

// Generated fresh at render time, never persisted — the bucket is private and
// signed URLs expire, so storing one would eventually 404.
export async function getSignedInvoiceUrl(path: string, expiresInSeconds = 3600): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}
