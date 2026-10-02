import { expect, it, vi } from 'vitest';
import { TokenCipher } from './crypto.js';
import { authorization, exchange, stateHash } from './oauth.js';
import type { OAuthConfig } from './oauth.js';
const config: OAuthConfig = {
  id: 'oura',
  clientId: 'id',
  clientSecret: 'secret',
  redirectUri: 'https://app.test/api/providers/oura/callback',
};
it('encrypts tokens with randomized authenticated envelopes bound to the owner/provider', () => {
  const cipher = new TokenCipher(Buffer.alloc(32, 7).toString('base64'));
  const token = { accessToken: 'secret', refreshToken: 'more-secret' };
  const first = cipher.seal(token, 'alice:oura'),
    second = cipher.seal(token, 'alice:oura');
  expect(first).not.toEqual(second);
  expect(first).not.toContain('secret');
  expect(cipher.open(first, 'alice:oura')).toEqual(token);
  expect(() => cipher.open(first, 'bob:oura')).toThrow();
  const parts = first.split('.');
  parts[2] = Buffer.alloc(16).toString('base64url');
  expect(() => cipher.open(parts.join('.'), 'alice:oura')).toThrow();
  expect(() => new TokenCipher('too-short')).toThrow();
});
it('uses unpredictable state and S256 PKCE for Oura', () => {
  const auth = authorization(config),
    url = new URL(auth.url);
  expect(auth.stateHash).toBe(stateHash(url.searchParams.get('state')!));
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  expect(url.searchParams.get('code_challenge')).not.toBe(auth.verifier);
  expect(authorization(config).stateHash).not.toBe(auth.stateHash);
});
it('persists rotated refresh tokens and granted scopes; refresh fallback preserves existing token', async () => {
  const fetcher = vi.fn<typeof fetch>(async () =>
    Response.json({
      access_token: 'new',
      refresh_token: 'rotated',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'daily tag',
    }),
  );
  const tokens = await exchange(config, { refreshToken: 'old', scopes: ['daily'] }, fetcher, 1000);
  expect(tokens).toEqual({
    accessToken: 'new',
    refreshToken: 'rotated',
    expiresAt: 3601000,
    scopes: ['daily', 'tag'],
  });
  expect(String(fetcher.mock.calls[0]![1]?.body)).toContain('refresh_token=old');
  fetcher.mockImplementationOnce(async () =>
    Response.json({ access_token: 'newer', token_type: 'bearer', expires_in: 60 }),
  );
  expect(
    (await exchange(config, { refreshToken: tokens.refreshToken, scopes: tokens.scopes }, fetcher))
      .refreshToken,
  ).toBe('rotated');
});
it('requires offline access and granted metric scopes', async () => {
  const noRefresh = vi.fn<typeof fetch>(async () =>
    Response.json({ access_token: 'x', expires_in: 10, token_type: 'bearer', scope: 'daily' }),
  );
  await expect(exchange(config, { code: 'code', verifier: 'verifier' }, noRefresh)).rejects.toThrow(
    'offline_access_required',
  );
  const denied = vi.fn<typeof fetch>(async () =>
    Response.json({
      access_token: 'x',
      refresh_token: 'r',
      expires_in: 10,
      token_type: 'bearer',
      scope: 'tag',
    }),
  );
  await expect(exchange(config, { code: 'code', verifier: 'verifier' }, denied)).rejects.toThrow(
    'required_scopes_missing',
  );
});
