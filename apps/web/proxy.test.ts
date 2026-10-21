import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./lib/env', () => ({ env: { supabaseUrl: '', supabaseAnonKey: '' }, supabaseConfigured: false }));
const { proxy } = await import('./proxy');
const at = (path: string) => proxy(new NextRequest(`https://distill-app-nu.vercel.app${path}`));

describe('a sign-in link that lands on the home page', () => {
  it('is forwarded to /auth/callback with everything in it, so it still signs them in', async () => {
    const r = await at('/?token_hash=abc&type=email');
    expect(r.status).toBe(307);
    expect(r.headers.get('location')).toBe('https://distill-app-nu.vercel.app/auth/callback?token_hash=abc&type=email');
    expect((await at('/?code=xyz')).headers.get('location')).toBe('https://distill-app-nu.vercel.app/auth/callback?code=xyz');
  });
  it('leaves every other page alone, including the wearable sign-in callbacks that also carry a code', async () => {
    expect((await at('/home')).headers.get('location')).toBeNull();
    expect((await at('/api/providers/oura/callback?code=xyz')).headers.get('location')).toBeNull();
    expect((await at('/auth/callback?token_hash=abc&type=email')).headers.get('location')).toBeNull();
  });
});
