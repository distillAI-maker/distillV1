import { afterEach, describe, expect, it, vi } from 'vitest';

const signInWithOtp = vi.fn();
vi.mock('../../lib/supabase/server', () => ({ supabaseServer: async () => ({ auth: { signInWithOtp } }) }));
const hdrs = new Map<string, string>([['host', 'distill-app-nu.vercel.app'], ['x-forwarded-proto', 'https']]);
vi.mock('next/headers', () => ({ headers: async () => ({ get: (k: string) => hdrs.get(k) ?? null }) }));
const { requestMagicLink } = await import('./actions');
const { copy } = await import('../../lib/copy');

const send = (email: string) => {
  const form = new FormData();
  form.set('email', email);
  return requestMagicLink({ status: 'idle', email: '' }, form);
};
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('asking for a sign-in email', () => {
  it('asks Supabase for a link back to this site’s /auth/callback, with the address tidied', async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    expect(await send('  Ishan@Example.com ')).toEqual({ status: 'sent', email: 'ishan@example.com' });
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'ishan@example.com',
      options: { emailRedirectTo: 'https://distill-app-nu.vercel.app/auth/callback' },
    });
  });
  it('uses APP_URL when it is set, so a preview never links people to the wrong site', async () => {
    vi.stubEnv('APP_URL', 'https://distill-app-nu.vercel.app/');
    signInWithOtp.mockResolvedValue({ error: null });
    await send('a@b.co');
    expect(signInWithOtp.mock.calls[0]![0].options.emailRedirectTo).toBe('https://distill-app-nu.vercel.app/auth/callback');
  });
  it('refuses a bad address without calling Supabase', async () => {
    expect((await send('not an email')).status).toBe('error');
    expect(signInWithOtp).not.toHaveBeenCalled();
  });
  it('says so plainly when Supabase is rate limited, or the email can’t be sent (SMTP)', async () => {
    signInWithOtp.mockResolvedValue({ error: { status: 429, message: 'rate limit' } });
    expect((await send('a@b.co')).message).toBe(copy.signIn.errorRate);
    signInWithOtp.mockResolvedValue({ error: { status: 500, message: 'Error sending magic link email' } });
    expect((await send('a@b.co')).message).toBe(copy.signIn.errorSend);
  });
});
