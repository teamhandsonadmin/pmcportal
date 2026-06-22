import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

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

  // 1. Try Prisma (direct DB — bypasses RLS entirely)
  let role = 'admin';
  try {
    const profile = await prisma.userProfile.findUnique({
      where: { email },
      select: { role: true },
    });
    if (profile) {
      role = profile.role;
    } else {
      // 2. Fall back to user_metadata set in Supabase Auth dashboard
      role = signInData.user?.user_metadata?.role ?? 'admin';
    }
  } catch {
    role = signInData.user?.user_metadata?.role ?? 'admin';
  }

  const dest = role === 'site_engineer' ? '/site-engineer/works' : '/projects';

  const res = NextResponse.redirect(new URL(dest, request.url), { status: 303 });
  res.cookies.set('user_role', role, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

