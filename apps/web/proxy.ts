import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { env, supabaseConfigured } from './lib/env';

/**
 * Refreshes the Supabase session on every request. Nothing is gated: signed out, the whole app runs
 * on this device (lib/progress/local.ts), so the 60-second number never waits on an email. Signing
 * in, from the invitation's link, carries that progress into an account.
 */
export async function proxy(request: NextRequest) {
  // Supabase sends a sign-in link to its default Site URL when the asking site isn't on its allow
  // list, so the link lands on the home page. Forward it to /auth/callback, which signs them in.
  const { pathname, searchParams } = request.nextUrl;
  if (pathname === '/' && ((searchParams.has('token_hash') && searchParams.has('type')) || searchParams.has('code'))) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/callback';
    return NextResponse.redirect(url);
  }
  if (!supabaseConfigured) return NextResponse.next();
  let response = NextResponse.next({ request });
  const client = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });
  await client.auth.getUser();
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|svg|webp)$).*)'],
};
