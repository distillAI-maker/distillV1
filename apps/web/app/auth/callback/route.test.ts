import { afterEach, describe, expect, it, vi } from 'vitest';

const auth = { verifyOtp: vi.fn(), exchangeCodeForSession: vi.fn(), getUser: vi.fn() };
const upsert = vi.fn();
let configured = true;
vi.mock('../../../lib/supabase/server', () => ({
  supabaseServer: async () => (configured ? { auth, from: () => ({ upsert }) } : null),
}));
const { GET } = await import('./route');

const call = (query: string) => GET(new Request(`https://distill-app-nu.vercel.app/auth/callback${query}`));
afterEach(() => {
  vi.clearAllMocks();
  configured = true;
});

describe('the magic link landing', () => {
  it('signs in from a token_hash link in any browser, creates the profile row, and resumes at the start', async () => {
    auth.verifyOtp.mockResolvedValue({ error: null });
    auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const r = await call('?token_hash=abc&type=email');
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc', type: 'email' });
    expect(upsert).toHaveBeenCalledWith({ user_id: 'u1' }, { onConflict: 'user_id', ignoreDuplicates: true });
    expect(r.status).toBe(307);
    expect(r.headers.get('location')).toBe('https://distill-app-nu.vercel.app/');
  });
  it('signs in from a PKCE code link (the default Supabase template)', async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const r = await call('?code=xyz');
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('xyz');
    expect(r.headers.get('location')).toBe('https://distill-app-nu.vercel.app/');
  });
  it('sends an expired, reused or other-browser code link back to sign-in, never half signed in', async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: new Error('code verifier not found') });
    const r = await call('?code=xyz');
    expect(r.headers.get('location')).toBe('https://distill-app-nu.vercel.app/sign-in?error=expired');
    expect(upsert).not.toHaveBeenCalled();
  });
  it('treats a link with nothing in it, or a project with no Supabase, as expired', async () => {
    expect((await call('')).headers.get('location')).toContain('/sign-in?error=expired');
    configured = false;
    expect((await call('?token_hash=abc&type=email')).headers.get('location')).toContain('/sign-in?error=expired');
  });
});
