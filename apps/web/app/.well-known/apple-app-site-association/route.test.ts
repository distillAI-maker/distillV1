import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('apple-app-site-association', () => {
  it('is missing until the Apple team is set', async () => {
    vi.stubEnv('APPLE_TEAM_ID', '');
    expect(GET().status).toBe(404);
  });

  it('ignores a team ID that is not one', () => {
    vi.stubEnv('APPLE_TEAM_ID', 'not a team');
    expect(GET().status).toBe(404);
  });

  it('lets the iOS app open sign-in links', async () => {
    vi.stubEnv('APPLE_TEAM_ID', 'ABCDE12345');
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    const body = await response.json();
    const [detail] = body.applinks.details;
    expect(detail.appIDs).toEqual(['ABCDE12345.com.distillthenoise.app']);
    expect(detail.components.map((c: { '/': string }) => c['/'])).toEqual(['/auth/callback', '/', '/']);
  });
});
