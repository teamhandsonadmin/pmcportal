// Server-side gatekeeper for the mobile app's single-device login lock.
// The mobile app never calls supabase.auth.signInWithPassword directly for
// its real login anymore — it calls this function instead, so a device
// mismatch is caught here, BEFORE any usable session is ever handed back
// to the client, not as an after-the-fact client-side check the app could
// just skip. See prisma/schema.prisma's UserProfile.lockedDeviceId comment
// and the mobile app's lib/deviceId.ts for the rest of this feature.
//
// Known, deliberate limitation (not an oversight): this closes the door on
// the actual app being used to share credentials onto a second device. It
// does NOT make device-binding literally unbypassable against a fully
// reverse-engineered client that skips this function entirely and calls
// Supabase's own public password-grant endpoint directly — that endpoint
// has no concept of "device id" to check, and Supabase has no Auth Hook
// that receives arbitrary per-request client data at token-issuance time.
// Closing that residual gap would mean replacing Supabase's stock
// password auth with a fully custom token-issuance backend — a
// substantially larger project than this feature, and deliberately not
// what's built here.
//
// Deploy: supabase functions deploy device-locked-login
// (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are
// auto-injected by Supabase into every Edge Function's environment.)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface LoginRequest {
  email: string;
  password: string;
  deviceId: string;
}

// Only the mobile app calls this function directly from client code (the
// admin-web dashboard never signs in through it), but that client runs on
// expo-web as well as native — and unlike native, a browser enforces CORS,
// preflighting this call with an OPTIONS request before ever sending the
// real POST. Without these headers the preflight itself gets rejected and
// the POST is never sent at all, surfacing as a generic "could not sign in"
// on web with no server-side error to explain why.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ ok: false, message: 'Method not allowed' }, 405);
  }

  let payload: LoginRequest;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, message: 'Invalid request body' }, 400);
  }

  const { email, password, deviceId } = payload;
  if (!email || !password || !deviceId) {
    return json({ ok: false, message: 'email, password, and deviceId are required' }, 400);
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Verifies the actual password exactly like the app would have done
  // directly — this genuinely creates a session server-side (that's how
  // Supabase Auth works), which is exactly why the checks below run BEFORE
  // any of it is ever returned to the caller.
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await anon.auth.signInWithPassword({ email, password });
  if (authError || !authData.session) {
    return json({ ok: false, code: 'invalid_credentials', message: 'Invalid email or password' }, 200);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // A missing profile row is deliberately not rejected here — the mobile
  // app's own existing "account isn't set up yet" check runs right after
  // this, against the very same session, so this function only owns the
  // device-binding and status concerns instead of re-implementing
  // validation that's already correct.
  const { data: profile } = await admin
    .from('user_profiles')
    .select('id, locked_device_id, status, is_active')
    .eq('email', email)
    .maybeSingle();

  if (!profile) {
    return json({ ok: true, access_token: authData.session.access_token, refresh_token: authData.session.refresh_token }, 200);
  }

  // Blocked/disabled accounts were previously only rejected by a
  // CLIENT-SIDE check that ran after this function had already handed back
  // a valid, usable session — a modified client could simply skip that
  // check and keep the tokens anyway. Moved server-side here, same
  // treatment as the device-lock check below: reject and revoke BEFORE any
  // token is ever returned, not after.
  if (profile.status !== 'active' || profile.is_active === false) {
    await admin.auth.admin.signOut(authData.session.access_token, 'local');
    return json(
      { ok: false, code: 'account_disabled', message: 'Your account is currently inactive. Contact your admin.' },
      200
    );
  }

  if (profile.locked_device_id && profile.locked_device_id !== deviceId) {
    // Revoke ONLY the session just issued for this rejected attempt —
    // 'local' scope, so the legitimate device's own separate session (if
    // it has one right now) is untouched.
    await admin.auth.admin.signOut(authData.session.access_token, 'local');

    await admin.from('activity_log').insert({
      user_id: profile.id,
      action_type: 'blocked_device_login',
      payload: { email, rejectedDeviceId: deviceId },
    });

    return json(
      {
        ok: false,
        code: 'device_locked',
        message:
          'This account is already logged in on another device. You cannot log in here. Contact your admin if you need to switch devices.',
      },
      200
    );
  }

  if (!profile.locked_device_id) {
    await admin
      .from('user_profiles')
      .update({ locked_device_id: deviceId, locked_device_registered_at: new Date().toISOString() })
      .eq('id', profile.id);
  }

  // Every successful login — first-ever or a repeat on the already-locked
  // device — updates lastLogin, not just the first one. This is the only
  // write path for it anywhere in either app (confirmed: nothing else ever
  // set this column), which is why it read null for every account before
  // this pass.
  await admin.from('user_profiles').update({ last_login: new Date().toISOString() }).eq('id', profile.id);

  return json({ ok: true, access_token: authData.session.access_token, refresh_token: authData.session.refresh_token }, 200);
});
