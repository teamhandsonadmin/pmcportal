import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // Public routes — always allow
  if (pathname.startsWith('/login') || pathname.startsWith('/auth/')) {
    return response;
  }

  // Not logged in → redirect to login
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Look up role for route enforcement
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('email', user.email!)
    .single();

  const role = profile?.role ?? 'admin';
  const isSiteEngineer = role === 'site_engineer';
  const isSiteEngineerRoute = pathname.startsWith('/site-engineer');

  // Site engineer trying to access admin routes → redirect to their dashboard
  if (isSiteEngineer && !isSiteEngineerRoute) {
    return NextResponse.redirect(new URL('/site-engineer/works', request.url));
  }

  // Admin/senior trying to access site-engineer routes → redirect to admin dashboard
  if (!isSiteEngineer && isSiteEngineerRoute) {
    return NextResponse.redirect(new URL('/projects', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};

