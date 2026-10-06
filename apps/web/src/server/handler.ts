import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { ProviderError, sleepDateSchema } from '@distill/providers';
import { stateHash } from '@distill/providers/server';
import { HttpError } from './service.js';
import type { Service } from './service.js';
import { handleDemoRequest } from './demo.js';

const response = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
async function body(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new HttpError(415, 'json_required');
  let text = '';
  if (request.body) {
    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        bytes += next.value.length;
        if (bytes > 8192) {
          await reader.cancel();
          throw new HttpError(413, 'request_too_large');
        }
        text += decoder.decode(next.value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      reader.releaseLock();
    }
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
}
export function secretEqual(actual: string, expected: string) {
  const a = Buffer.from(actual),
    b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function createHandler(
  service: () => Service,
  defer: (task: () => Promise<unknown>) => void,
  demo: (request: Request) => Promise<Response> = handleDemoRequest,
) {
  return async (request: Request): Promise<Response> => {
    try {
      const url = new URL(request.url),
        path = url.pathname.replace(/\/$/, ''),
        method = request.method;
      if (path === '/api/health' && method === 'GET') return response({ phase: 2, status: 'ok' });
      if (path === '/api/demo' || path.startsWith('/api/demo/')) return demo(request);
      const app = service();
      if (path === '/api/cron/sync' && method === 'GET') {
        if (!secretEqual(request.headers.get('authorization') ?? '', `Bearer ${app.cronSecret}`))
          throw new HttpError(401, 'cron_authentication_required');
        return response(await app.worker.run());
      }
      if (path === '/api/auth/magic-link' && method === 'POST') {
        const { email } = z
          .object({ email: z.email().max(254) })
          .strict()
          .parse(await body(request));
        await app.magicLink(email);
        return response({ status: 'email_requested' }, 202);
      }
      if (path === '/api/auth/confirm' && method === 'GET') {
        const token = z.string().min(20).max(2048).parse(url.searchParams.get('token_hash'));
        return response(await app.confirm(token));
      }
      const callback = /^\/api\/providers\/(oura|whoop|fitbit)\/callback$/.exec(path);
      if (callback && method === 'GET') {
        const provider = z.enum(['oura', 'whoop', 'fitbit']).parse(callback[1]);
        const state = z.string().min(20).max(1024).parse(url.searchParams.get('state'));
        const cookie = request.headers
          .get('cookie')
          ?.split(';')
          .map((s) => s.trim())
          .find((s) => s.startsWith(`oauth_${provider}=`))
          ?.split('=')[1];
        if (!cookie || !secretEqual(cookie, stateHash(state)))
          throw new HttpError(400, 'oauth_browser_mismatch');
        const code = z.string().min(1).max(4096).parse(url.searchParams.get('code'));
        const userId = await app.finishOAuth(provider, state, code);
        defer(() => app.worker.run(userId));
        const browser = request.headers.get('accept')?.includes('text/html');
        return response({ status: 'connected', backfill: 'queued' }, browser ? 303 : 200, {
          ...(browser ? { Location: `${app.appUrl}/connect` } : {}),
          'Set-Cookie': `oauth_${provider}=; HttpOnly; SameSite=Lax; Path=/api/providers; Max-Age=0${app.appUrl.startsWith('https:') ? '; Secure' : ''}`,
        });
      }
      const user = await app.authenticate(request);
      // No caller-supplied userId is accepted; every database operation uses verified Auth identity.
      if (path === '/api/account' && method === 'DELETE') {
        await app.deleteAccount(user);
        return response({ status: 'deleted' });
      }
      await app.repo.ensureAccount(user.id);
      const connect = /^\/api\/providers\/(oura|whoop|fitbit)\/connect$/.exec(path);
      if (connect && method === 'POST') {
        const provider = z.enum(['oura', 'whoop', 'fitbit']).parse(connect[1]);
        const auth = await app.startOAuth(user.id, provider);
        return response({ authorizationUrl: auth.url }, 200, {
          'Set-Cookie': `oauth_${provider}=${auth.stateHash}; HttpOnly; SameSite=Lax; Path=/api/providers; Max-Age=600${app.appUrl.startsWith('https:') ? '; Secure' : ''}`,
        });
      }
      if (path === '/api/providers' && method === 'GET')
        return response(await app.repo.status(user.id));
      if (path === '/api/sync' && method === 'POST') {
        defer(() => app.worker.run(user.id));
        return response({ status: 'queued' }, 202);
      }
      if (path === '/api/imports' && method === 'POST') {
        const input = z
          .discriminatedUnion('source', [
            z.object({ source: z.literal('csv') }).strict(),
            z
              .object({
                source: z.literal('apple_export'),
                sourceName: z.string().trim().min(1).max(512),
              })
              .strict(),
          ])
          .parse(await body(request));
        return response(
          await app.createImport(
            user.id,
            input.source,
            'sourceName' in input ? input.sourceName : undefined,
          ),
          201,
        );
      }
      const complete = /^\/api\/imports\/([^/]+)\/complete$/.exec(path);
      if (complete && method === 'POST') {
        await app.queueImport(user.id, z.uuid().parse(complete[1]));
        defer(() => app.worker.run(user.id));
        return response({ status: 'queued' }, 202);
      }
      if (path === '/api/nights' && method === 'GET') {
        const from = sleepDateSchema.parse(url.searchParams.get('from')),
          to = sleepDateSchema.parse(url.searchParams.get('to'));
        if (from >= to || +new Date(to) - +new Date(from) > 366 * 86400000)
          throw new HttpError(400, 'range_must_be_1_to_366_days');
        return response((await app.repo.readNights(user.id, from, to)).map((r) => r.record));
      }
      return response({ error: 'not_found' }, 404);
    } catch (error) {
      if (error instanceof HttpError) return response({ error: error.message }, error.status);
      if (error instanceof z.ZodError) return response({ error: 'invalid_input' }, 400);
      if (error instanceof ProviderError)
        return response(
          { error: error.code },
          error.status >= 400 && error.status < 500 ? error.status : 503,
        );
      // Never expose OAuth responses, token envelopes, raw health records or connection strings.
      return response({ error: 'request_failed' }, 503);
    }
  };
}
