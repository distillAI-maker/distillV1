import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { database, Repository } from '@distill/data';
import { TokenCipher, authorization, exchange, stateHash } from '@distill/providers/server';
import type { OAuthConfig } from '@distill/providers/server';
import type { OAuthProviderId } from '@distill/providers';
import { Worker } from './worker.js';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const required = (env: NodeJS.ProcessEnv, name: string) => {
  const value = env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};
export class Service {
  readonly repo: Repository;
  readonly cipher: TokenCipher;
  readonly worker: Worker;
  readonly appUrl: string;
  readonly cronSecret: string;
  private admin;
  private publicClient;
  constructor(private env = process.env) {
    this.repo = new Repository(database(required(env, 'DATABASE_URL')).db);
    this.cipher = new TokenCipher(required(env, 'TOKEN_ENCRYPTION_KEY'));
    this.appUrl = new URL(required(env, 'APP_URL')).origin;
    this.cronSecret = required(env, 'CRON_SECRET');
    if (this.cronSecret.length < 32)
      throw new Error('CRON_SECRET must contain at least 32 characters');
    const options = { auth: { persistSession: false, autoRefreshToken: false } };
    this.admin = createClient(
      required(env, 'SUPABASE_URL'),
      required(env, 'SUPABASE_SERVICE_ROLE_KEY'),
      options,
    );
    this.publicClient = createClient(
      required(env, 'SUPABASE_URL'),
      required(env, 'SUPABASE_ANON_KEY'),
      options,
    );
    this.worker = new Worker({
      repo: this.repo,
      cipher: this.cipher,
      oauth: (id) => this.oauth(id),
      download: async (path) => {
        const { data, error } = await this.admin.storage
          .from('wearable-imports')
          .createSignedUrl(path, 300);
        if (error) throw new Error('Import download unavailable');
        const response = await fetch(data.signedUrl, {
          signal: AbortSignal.timeout(240000),
          redirect: 'error',
        });
        if (!response.ok || !response.body) throw new Error('Import download failed');
        const stream = response.body;
        return (async function* () {
          const reader = stream.getReader();
          try {
            while (true) {
              const next = await reader.read();
              if (next.done) break;
              yield next.value;
            }
          } finally {
            await reader.cancel();
            reader.releaseLock();
          }
        })();
      },
    });
  }
  oauth(id: OAuthProviderId): OAuthConfig {
    const prefix = id.toUpperCase();
    return {
      id,
      clientId: required(this.env, `${prefix}_CLIENT_ID`),
      clientSecret: required(this.env, `${prefix}_CLIENT_SECRET`),
      redirectUri: `${this.appUrl}/api/providers/${id}/callback`,
      legacyFitbitEnabled: this.env.FITBIT_LEGACY_ENABLED === 'true',
    };
  }
  async authenticate(request: Request) {
    const token = /^Bearer (\S+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
    if (!token) throw new HttpError(401, 'authentication_required');
    const { data, error } = await this.admin.auth.getUser(token);
    if (error || !data.user || data.user.is_anonymous)
      throw new HttpError(401, 'authentication_required');
    return { id: data.user.id, email: data.user.email };
  }
  async magicLink(email: string) {
    const { error } = await this.publicClient.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${this.appUrl}/api/auth/confirm` },
    });
    if (error) throw new HttpError(error.status === 429 ? 429 : 503, 'email_link_unavailable');
  }
  async confirm(tokenHash: string) {
    // A fresh client avoids retaining one request's session on the shared service.
    const client = createClient(
      required(this.env, 'SUPABASE_URL'),
      required(this.env, 'SUPABASE_ANON_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
    if (error || !data.session) throw new HttpError(401, 'email_link_invalid');
    return data.session;
  }
  async startOAuth(userId: string, provider: OAuthProviderId) {
    await this.repo.ensureAccount(userId);
    const auth = authorization(this.oauth(provider));
    await this.repo.saveOAuthState({
      hash: auth.stateHash,
      userId,
      provider,
      verifierEnvelope: this.cipher.seal(auth.verifier, `${userId}:${provider}:state`),
      expiresAt: new Date(Date.now() + 10 * 60000),
    });
    return auth;
  }
  async finishOAuth(provider: OAuthProviderId, state: string, code: string) {
    const saved = await this.repo.consumeOAuthState(stateHash(state), provider, new Date());
    if (!saved) throw new HttpError(400, 'oauth_state_invalid');
    const { data, error } = await this.admin.auth.admin.getUserById(saved.userId);
    if (error || !data.user) throw new HttpError(401, 'authentication_required');
    const verifier = z
      .string()
      .parse(this.cipher.open(saved.verifierEnvelope, `${saved.userId}:${provider}:state`));
    const tokens = await exchange(this.oauth(provider), { code, verifier });
    await this.repo.connect(
      saved.userId,
      provider,
      this.cipher.seal(tokens, `${saved.userId}:${provider}`),
      new Date(),
    );
    return saved.userId;
  }
  async createImport(userId: string, source: 'apple_export' | 'csv', sourceName?: string) {
    await this.repo.ensureAccount(userId);
    const status = await this.repo.status(userId);
    if (status.imports.filter((i) => i.status !== 'done').length >= 10)
      throw new HttpError(429, 'too_many_pending_imports');
    const id = randomUUID(),
      path = `${userId}/${id}/${source === 'csv' ? 'nights.csv' : 'export.zip'}`;
    await this.repo.createImport({ id, userId, source, sourceName, path });
    return {
      id,
      bucket: 'wearable-imports',
      path,
      uploadUrl: `${required(this.env, 'SUPABASE_URL')}/storage/v1/object/wearable-imports/${path}`,
    };
  }
  async queueImport(userId: string, id: string) {
    const paths = await this.repo.uploadPaths(userId);
    const path = paths.find((p) => p.path.split('/')[1] === id)?.path;
    if (!path) throw new HttpError(404, 'import_not_found');
    const { error } = await this.admin.storage.from('wearable-imports').info(path);
    if (error) throw new HttpError(409, 'upload_not_ready');
    if (!(await this.repo.queueImport(userId, id)))
      throw new HttpError(409, 'import_already_queued');
  }
  async deleteAccount(user: { id: string; email?: string }) {
    // Mark first. Writers lock and check the account before committing; upload RLS closes too.
    await this.repo.beginDeletion(user.id);
    // Every permitted Storage path was recorded before uploading began.
    for (const { path } of await this.repo.uploadPaths(user.id)) {
      const { error } = await this.admin.storage.from('wearable-imports').remove([path]);
      if (error) throw new HttpError(503, 'deletion_retry_required');
    }
    // Auth deletion can fail (e.g. an in-flight Storage write). Keep the deleting tombstone
    // and tracked paths until it succeeds so DELETE is safely retryable.
    await this.repo.deleteSignup(user.email);
    const { error } = await this.admin.auth.admin.deleteUser(user.id, false);
    if (error) throw new HttpError(503, 'deletion_retry_required');
    // The migration's auth.users FK cascades accounts, tokens, states, raw records and jobs.
  }
}
let singleton: Service | undefined;
export const getService = () => (singleton ??= new Service());
