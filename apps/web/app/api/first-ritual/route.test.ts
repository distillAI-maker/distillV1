import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyProgress } from '../../../lib/progress/types';
import { POST } from './route';

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(new Request('http://localhost/api/first-ritual', { method: 'POST', headers: { host: 'localhost', ...headers }, body: JSON.stringify(body) }));

afterEach(() => vi.unstubAllEnvs());

describe('POST /api/first-ritual', () => {
  it('says nothing to wait for when Claude is off, and spends nothing', async () => {
    vi.stubEnv('ENGINE_CLAUDE', 'off');
    const res = await post({ progress: emptyProgress(), timeZone: 'America/Los_Angeles' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ parts: null });
  });

  it("only answers this site's own pages", async () => {
    expect((await post({ progress: emptyProgress() }, { origin: 'https://elsewhere.example' })).status).toBe(403);
    expect((await post({ progress: emptyProgress() }, { origin: 'http://localhost' })).status).toBe(200);
  });

  it('turns away anything that is not a progress', async () => {
    expect((await post({ progress: { nope: true } })).status).toBe(400);
    expect((await post({ progress: emptyProgress(), extra: 1 })).status).toBe(400);
  });
});
