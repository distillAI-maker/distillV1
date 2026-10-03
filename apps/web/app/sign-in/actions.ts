'use server';

import { z } from 'zod';
import { copy } from '../../lib/copy';
import { supabaseServer } from '../../lib/supabase/server';

export interface SignInState {
  status: 'idle' | 'sent' | 'error';
  email: string;
  message?: string;
}

const emailSchema = z.string().trim().toLowerCase().email().max(254);

/** Asks Supabase to email a magic link. The link lands on /auth/callback, which sets the session. */
export async function requestMagicLink(_prev: SignInState, form: FormData): Promise<SignInState> {
  const raw = String(form.get('email') ?? '');
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) return { status: 'error', email: raw, message: copy.signIn.errorInvalid };
  const email = parsed.data;
  const client = await supabaseServer();
  if (!client) return { status: 'error', email, message: copy.signIn.errorSend };
  const origin = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${new URL(origin).origin}/auth/callback` },
  });
  if (error)
    return {
      status: 'error',
      email,
      message: error.status === 429 ? copy.signIn.errorRate : copy.signIn.errorSend,
    };
  return { status: 'sent', email };
}
