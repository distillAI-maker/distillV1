import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { ProviderError } from '../http.js';
import type { Fetch } from '../http.js';
import type { OAuthProviderId } from '../types.js';

export const tokenSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number(),
  scopes: z.array(z.string()),
});
export type Tokens = z.infer<typeof tokenSchema>;
export interface OAuthConfig {
  id: OAuthProviderId;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  legacyFitbitEnabled?: boolean;
}
const settings = {
  oura: {
    authorize: 'https://cloud.ouraring.com/oauth/authorize',
    token: 'https://api.ouraring.com/oauth/token',
    scope: 'daily workout tag',
    pkce: true,
  },
  whoop: {
    authorize: 'https://api.prod.whoop.com/oauth/oauth2/auth',
    token: 'https://api.prod.whoop.com/oauth/oauth2/token',
    scope: 'read:sleep read:recovery read:cycles read:workout offline',
    pkce: false,
  },
  fitbit: {
    authorize: 'https://www.fitbit.com/oauth2/authorize',
    token: 'https://api.fitbit.com/oauth2/token',
    scope: 'sleep activity heartrate respiratory_rate temperature',
    pkce: true,
  },
} as const;
export const stateHash = (value: string) => createHash('sha256').update(value).digest('hex');
export function assertOAuthAvailable(config: OAuthConfig, now = Date.now()) {
  if (
    config.id === 'fitbit' &&
    (!config.legacyFitbitEnabled || now >= +new Date('2026-10-30T00:00:00Z'))
  )
    throw new ProviderError('fitbit_migration_required', 503);
}
export function authorization(config: OAuthConfig) {
  assertOAuthAvailable(config);
  const state = randomBytes(32).toString('base64url'),
    verifier = randomBytes(32).toString('base64url');
  const s = settings[config.id],
    url = new URL(s.authorize);
  const params: Record<string, string> = {
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: s.scope,
    state,
  };
  if (s.pkce) {
    params.code_challenge_method = 'S256';
    params.code_challenge = createHash('sha256').update(verifier).digest('base64url');
  }
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return { url: url.toString(), stateHash: stateHash(state), verifier };
}
export async function exchange(
  config: OAuthConfig,
  grant: { code: string; verifier: string } | { refreshToken: string; scopes: string[] },
  fetcher: Fetch = fetch,
  now = Date.now(),
): Promise<Tokens> {
  assertOAuthAvailable(config, now);
  const s = settings[config.id];
  const body = new URLSearchParams({ client_id: config.clientId });
  const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (config.id === 'fitbit')
    headers.Authorization = `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`;
  else body.set('client_secret', config.clientSecret);
  if ('code' in grant) {
    body.set('grant_type', 'authorization_code');
    body.set('code', grant.code);
    body.set('redirect_uri', config.redirectUri);
    if (s.pkce) body.set('code_verifier', grant.verifier);
  } else {
    body.set('grant_type', 'refresh_token');
    body.set('refresh_token', grant.refreshToken);
    if (config.id === 'whoop') body.set('scope', 'offline');
  }
  const response = await fetcher(s.token, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(30000),
    redirect: 'error',
  });
  if (!response.ok) throw new ProviderError('oauth_exchange_failed', response.status);
  const data = z
    .object({
      access_token: z.string().min(1),
      refresh_token: z.string().min(1).optional(),
      expires_in: z.number().positive(),
      scope: z.string().optional(),
      token_type: z.string(),
    })
    .parse(await response.json());
  if (data.token_type.toLowerCase() !== 'bearer') throw new Error('Unsupported OAuth token type');
  const refreshToken =
    data.refresh_token ?? ('refreshToken' in grant ? grant.refreshToken : undefined);
  if (!refreshToken) throw new ProviderError('offline_access_required', 400);
  const scopes =
    data.scope?.split(/\s+/).filter(Boolean) ?? ('scopes' in grant ? grant.scopes : []);
  const required =
    config.id === 'oura'
      ? ['daily']
      : config.id === 'whoop'
        ? ['read:sleep', 'read:recovery', 'read:cycles', 'read:workout', 'offline']
        : s.scope.split(' ');
  if (!required.every((scope) => scopes.includes(scope)))
    throw new ProviderError('required_scopes_missing', 403);
  return {
    accessToken: data.access_token,
    refreshToken,
    expiresAt: now + data.expires_in * 1000,
    scopes,
  };
}
