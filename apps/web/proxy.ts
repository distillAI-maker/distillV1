import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { env, supabaseConfigured } from './lib/env';

const publicPaths = ['/', '/sign-in', '/auth/callback'];

/**
 * Refreshes the Supabase session on every request and keeps signed-out visitors on the public
 * screens. Without a configured project the app runs on this device only and nothing is gated.
 */
export async function proxy(request: NextRequest) {
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
  const {
    data: { user },
  } = await client.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPublic = publicPaths.includes(path) || path.startsWith('/api/');
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|svg|webp)$).*)'],
};
