import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email    = formData.get('email')    as string;
  const password = formData.get('password') as string;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'Invalid email or password');
    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  return NextResponse.redirect(new URL('/projects', request.url), { status: 303 });
}
