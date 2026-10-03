import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabaseServer } from '../../../lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * The magic link lands here. The email template sends `token_hash` and `type`; a PKCE flow sends
 * `code`. Either way the session is written to cookies and the person continues where they were.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const code = url.searchParams.get('code');
  const client = await supabaseServer();
  const fail = () => NextResponse.redirect(new URL('/sign-in?error=expired', url.origin));
  if (!client) return fail();

  let ok = false;
  if (tokenHash && type) {
    const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
  } else if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    ok = !error;
  }
  if (!ok) return fail();

  const { data } = await client.auth.getUser();
  if (data.user) {
    // The profile row is the anchor for saved progress; creating it is idempotent.
    await client.from('app_profiles').upsert({ user_id: data.user.id }, { onConflict: 'user_id' });
  }
  return NextResponse.redirect(new URL('/connect', url.origin));
}
