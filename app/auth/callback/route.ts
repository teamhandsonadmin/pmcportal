import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email    = formData.get('email')    as string;
  const password = formData.get('password') as string;

  const supabase = await createClient();
  const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'Invalid email or password');
    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  // Read role from user_metadata (set in Supabase dashboard per user)
  const role: string = signInData.user?.user_metadata?.role ?? 'admin';
  const dest = role === 'site_engineer' ? '/site-engineer/works' : '/projects';

  const res = NextResponse.redirect(new URL(dest, request.url), { status: 303 });
  // Cache the role in a cookie so proxy.ts can enforce routing without a DB call
  res.cookies.set('user_role', role, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return res;
}

