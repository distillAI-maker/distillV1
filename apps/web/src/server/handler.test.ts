import { expect, it, vi } from 'vitest';
import { createHandler } from './handler.js';
import { HttpError } from './service.js';
import type { Service } from './service.js';
import { stateHash } from '@distill/providers/server';

function setup() {
  const app = {
    appUrl: 'https://app.test',
    cronSecret: 'a'.repeat(32),
    authenticate: vi.fn(async () => ({ id: 'alice', email: 'alice@example.test' })),
    repo: {
      ensureAccount: vi.fn(),
      status: vi.fn(async () => ({ connections: [], imports: [] })),
      readNights: vi.fn(async () => []),
    },
    worker: { run: vi.fn(async () => ({ units: 1 })) },
    startOAuth: vi.fn(),
    finishOAuth: vi.fn(async () => 'alice'),
    deleteAccount: vi.fn(),
    createImport: vi.fn(),
    queueImport: vi.fn(),
    magicLink: vi.fn(),
    confirm: vi.fn(),
  };
  const deferred: (() => Promise<unknown>)[] = [];
  return {
    app,
    deferred,
    handle: createHandler(
      () => app as unknown as Service,
      (task) => deferred.push(task),
    ),
  };
}
it('authenticates before all user data operations and never accepts a user ID override', async () => {
  const { app, handle } = setup();
  app.authenticate.mockRejectedValueOnce(new HttpError(401, 'authentication_required'));
  expect(
    (await handle(new Request('https://app.test/api/nights?from=2026-01-01&to=2026-02-01'))).status,
  ).toBe(401);
  expect(app.repo.readNights).not.toHaveBeenCalled();
  await handle(new Request('https://app.test/api/nights?from=2026-01-01&to=2026-02-01&userId=bob'));
  expect(app.repo.readNights).toHaveBeenCalledWith('alice', '2026-01-01', '2026-02-01');
});
it('rejects missing or incorrect cron secrets and accepts the exact bearer secret', async () => {
  const { app, handle } = setup();
  expect((await handle(new Request('https://app.test/api/cron/sync'))).status).toBe(401);
  expect(app.worker.run).not.toHaveBeenCalled();
  const r = await handle(
    new Request('https://app.test/api/cron/sync', {
      headers: { Authorization: `Bearer ${app.cronSecret}` },
    }),
  );
  expect(r.status).toBe(200);
  expect(app.authenticate).not.toHaveBeenCalled();
});
it('binds OAuth callback to the initiating browser before exchanging the code', async () => {
  const { app, handle, deferred } = setup();
  const state = 'state-value-with-enough-randomness';
  const url = `https://app.test/api/providers/oura/callback?code=secret-code&state=${state}`;
  expect((await handle(new Request(url))).status).toBe(400);
  expect(app.finishOAuth).not.toHaveBeenCalled();
  const response = await handle(
    new Request(url, { headers: { cookie: `oauth_oura=${stateHash(state)}` } }),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  expect(app.worker.run).not.toHaveBeenCalled();
  await deferred[0]!();
  expect(app.worker.run).toHaveBeenCalledWith('alice');
});
it('rejects arbitrary upload paths and scopes account deletion to authenticated identity', async () => {
  const { app, handle } = setup();
  const bad = await handle(
    new Request('https://app.test/api/imports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'csv', userId: 'bob', path: 'bob/file' }),
    }),
  );
  expect(bad.status).toBe(400);
  expect(app.createImport).not.toHaveBeenCalled();
  await handle(new Request('https://app.test/api/account?userId=bob', { method: 'DELETE' }));
  expect(app.deleteAccount).toHaveBeenCalledWith({ id: 'alice', email: 'alice@example.test' });
});
it('returns safe errors without token, health payload or database details', async () => {
  const { app, handle } = setup();
  app.repo.status.mockRejectedValueOnce(new Error('postgres://secret token health payload'));
  const result = await handle(new Request('https://app.test/api/providers'));
  expect(result.status).toBe(503);
  expect(await result.json()).toEqual({ error: 'request_failed' });
});
