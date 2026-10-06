import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET as handle } from './route';
import { Journey } from '../../../../src/server/journey';
const getUser = vi.fn();
vi.mock('../../../../lib/supabase/server', () => ({
  supabaseServer: async () => ({ auth: { getUser } }),
}));
vi.mock('@distill/data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@distill/data')>()),
  database: () => ({ db: {} }),
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
describe('authenticated app boundary', () => {
  it('rejects a request whose bearer identity cannot be verified', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid') });
    const response = await handle(
      new Request('https://app.example/api/app/progress', {
        headers: { authorization: 'Bearer forged' },
      }),
    );
    expect(response.status).toBe(401);
    expect(getUser).toHaveBeenCalledWith('forged');
  });
  it('uses the verified user, and refuses a caller-supplied user ID', async () => {
    vi.stubEnv('DATABASE_URL', 'test-only');
    getUser.mockResolvedValue({ data: { user: { id: 'alice' } }, error: null });
    const load = vi.spyOn(Journey.prototype, 'load').mockResolvedValue(null);
    expect((await handle(new Request('https://app.example/api/app/progress'))).status).toBe(200);
    expect(load).toHaveBeenCalledWith('alice');
    const response = await handle(
      new Request('https://app.example/api/app/progress', {
        method: 'POST',
        headers: { origin: 'https://app.example', 'content-type': 'application/json' },
        body: JSON.stringify({ userId: 'bob' }),
      }),
    );
    expect(response.status).toBe(400);
  });
  it('rejects cross-site cookie-authenticated mutations', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'alice' } }, error: null });
    const response = await handle(
      new Request('https://app.example/api/app/progress', {
        method: 'DELETE',
        headers: { origin: 'https://other.example' },
      }),
    );
    expect(response.status).toBe(403);
  });
});
