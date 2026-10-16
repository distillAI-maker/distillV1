'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { copy } from '../../lib/copy';
import { supabaseServer } from '../../lib/supabase/server';

export interface SignInState {
  status: 'idle' | 'sent' | 'error';
  email: string;
  message?: string;
}

const emailSchema = z.string().trim().toLowerCase().email().max(254);

/**
 * Where the magic link sends people back to: APP_URL when it is set, otherwise the site this request
 * came to (so production, previews and localhost each link to themselves, never to localhost).
 */
async function siteOrigin() {
  const set = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (set) return new URL(set).origin;
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (!host) return 'http://localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/** Asks Supabase to email a magic link. The link lands on /auth/callback, which sets the session. */
export async function requestMagicLink(_prev: SignInState, form: FormData): Promise<SignInState> {
  const raw = String(form.get('email') ?? '');
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) return { status: 'error', email: raw, message: copy.signIn.errorInvalid };
  const email = parsed.data;
  const client = await supabaseServer();
  if (!client) return { status: 'error', email, message: copy.signIn.errorSend };
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/callback` },
  });
  if (error)
    return {
      status: 'error',
      email,
      message: error.status === 429 ? copy.signIn.errorRate : copy.signIn.errorSend,
    };
  return { status: 'sent', email };
}
