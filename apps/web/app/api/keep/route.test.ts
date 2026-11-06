import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyProgress } from '../../../lib/progress/types';
import { POST } from './route';

const call = (body: unknown, headers: Record<string, string> = {}) =>
  POST(new Request('https://app.example/api/keep', { method: 'POST', headers: { host: 'app.example', ...headers }, body: JSON.stringify(body) }));

describe('keeping progress on the server when someone joins', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('only answers this site', async () => {
    expect((await call({}, { origin: 'https://elsewhere.example' })).status).toBe(403);
  });
  it('says it kept nothing when the server is not set up, so the link carries it from this browser instead', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    const r = await call({ email: 'a@b.co', progress: emptyProgress() });
    expect(await r.json()).toEqual({ kept: false });
  });
});
