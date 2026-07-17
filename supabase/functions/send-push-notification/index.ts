// Thin relay to Expo's push API — all the "who to notify, what to say, and
// don't repeat yourself" business logic lives in the Postgres trigger that
// calls this (see supabase/push-notifications.sql), matching this
// project's existing convention of keeping business logic in Postgres
// functions rather than application/edge code. This function just forwards
// whatever it's given.
//
// Deploy: supabase functions deploy send-push-notification
// (Supabase auto-injects SUPABASE_URL / SUPABASE_ANON_KEY /
// SUPABASE_SERVICE_ROLE_KEY into every Edge Function's environment — no
// `supabase secrets set` needed for those three specifically.)

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface PushRequest {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Supabase's platform-level JWT check (verify_jwt, default on) accepts
  // ANY valid project JWT, including the public anon key shipped inside
  // the mobile app bundle — that's too permissive for a function that can
  // force arbitrary push sends. Require the specific service-role key the
  // Postgres trigger authenticates with, rejecting everything else
  // (including a well-formed anon-key JWT) even though the platform itself
  // would have let it through.
  const auth = req.headers.get('Authorization') ?? '';
  const expected = `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`;
  if (auth !== expected) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let payload: PushRequest;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  const tokens = (payload.tokens ?? []).filter(
    (t): t is string => typeof t === 'string' && t.startsWith('ExponentPushToken')
  );
  if (tokens.length === 0 || !payload.title || !payload.body) {
    return new Response(JSON.stringify({ error: 'tokens, title, and body are required' }), { status: 400 });
  }

  const messages = tokens.map((to) => ({
    to,
    title: payload.title,
    body: payload.body,
    sound: 'default',
    priority: 'high',
    data: payload.data ?? {},
  }));

  const expoRes = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    },
    body: JSON.stringify(messages),
  });

  const result = await expoRes.json();
  return new Response(JSON.stringify(result), {
    status: expoRes.ok ? 200 : 502,
    headers: { 'Content-Type': 'application/json' },
  });
});
