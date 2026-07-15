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

  // Read role from cookie set at login (avoids a DB call on every request).
  // Each role scoped to its own route prefix maps to that prefix here; a
  // role hitting any OTHER role's prefix (including an unscoped admin/senior
  // hitting either) gets redirected to its own home instead.
  const role = request.cookies.get('user_role')?.value ?? 'admin';
  const ROLE_HOME: Record<string, string> = {
    // Single "use the mobile app" notice page — the real site-engineer
    // experience lives in the separate Expo app, not here (see
    // app/site-engineer/page.tsx).
    site_engineer: '/site-engineer',
    client: '/client/sequence',
  };
  const SCOPED_PREFIXES = ['/site-engineer', '/client'];

  const ownPrefix = ROLE_HOME[role]?.split('/').slice(0, 2).join('/'); // e.g. '/site-engineer'
  const matchedPrefix = SCOPED_PREFIXES.find((p) => pathname.startsWith(p));

  if (matchedPrefix && matchedPrefix !== ownPrefix) {
    return NextResponse.redirect(new URL(ROLE_HOME[role] ?? '/projects', request.url));
  }
  if (!matchedPrefix && ownPrefix) {
    return NextResponse.redirect(new URL(ROLE_HOME[role], request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};

