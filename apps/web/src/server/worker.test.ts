import { expect, it, vi } from 'vitest';
import { Worker, syncWindow } from './worker.js';
import { TokenCipher } from '@distill/providers/server';
import type { Connection, Repository } from '@distill/data';
const now = new Date('2026-10-02T12:00:00Z');
const cipher = new TokenCipher(Buffer.alloc(32, 2).toString('base64'));
const row: Connection = {
  id: 'id',
  userId: 'u',
  provider: 'oura',
  tokenEnvelope: cipher.seal(
    {
      accessToken: 'access',
      refreshToken: 'refresh',
      scopes: ['daily'],
      expiresAt: +now + 3600000,
    },
    'u:oura',
  ),
  backfillBefore: '2026-09-01',
  lastSyncedAt: now,
  nextSyncAt: now,
  lease: 'lease',
  leaseUntil: new Date(+now + 600000),
  errorCode: null,
  disabled: false,
};
function setup(fetcher: typeof fetch) {
  const repo = { finishConnection: vi.fn(), failConnection: vi.fn(), saveTokens: vi.fn() };
  const worker = new Worker({
    repo: repo as unknown as Repository,
    cipher,
    oauth: (id) => ({
      id,
      clientId: 'id',
      clientSecret: 'secret',
      redirectUri: 'https://app.test/callback',
    }),
    fetcher,
    now: () => now,
    download: vi.fn(),
  });
  return { repo, worker };
}
it('prioritizes recent corrections, then walks history back without stopping at gaps', () => {
  expect(syncWindow({ ...row, lastSyncedAt: null }, now).mode).toBe('daily');
  expect(syncWindow(row, now).to).toEqual(new Date('2026-09-01'));
  expect(syncWindow({ ...row, backfillBefore: '1970-01-02' }, now).from).toEqual(
    new Date('1970-01-01'),
  );
});
it('advances an empty backfill window only after successful persistence', async () => {
  const { worker, repo } = setup(vi.fn(async () => Response.json({ data: [], next_token: null })));
  await worker.sync(row);
  expect(repo.finishConnection).toHaveBeenCalledWith(
    row,
    { nights: [], workouts: [], tags: [] },
    expect.anything(),
    expect.objectContaining({ backfillBefore: '2025-09-01' }),
  );
  expect(repo.failConnection).not.toHaveBeenCalled();
});
it('does not advance a rate-limited or partial window and schedules a retry', async () => {
  const { worker, repo } = setup(
    vi.fn(async () => new Response(null, { status: 429, headers: { 'retry-after': '120' } })),
  );
  await worker.sync(row);
  expect(repo.finishConnection).not.toHaveBeenCalled();
  expect(repo.failConnection).toHaveBeenCalledWith(
    row,
    'provider_request_failed',
    new Date(+now + 120000),
    false,
  );
});
it('marks revoked credentials for reconnect rather than retrying forever', async () => {
  const { worker, repo } = setup(vi.fn(async () => new Response(null, { status: 401 })));
  await worker.sync(row);
  expect(repo.failConnection).toHaveBeenCalledWith(
    row,
    'reconnect_required',
    expect.any(Date),
    true,
  );
});
