import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyProgress } from '../../../lib/progress/types';
import { POST } from './route';

const compose = vi.hoisted(() => vi.fn());
vi.mock('../../../src/server/engine', () => ({ previewCompose: compose }));
vi.mock('../../../src/server/engine-deps', () => ({ engineClient: () => ({}) }));

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

  describe('with Claude on', () => {
    const asked = (who: string) => ({
      ...emptyProgress(),
      asks: [{ q: 'Who do you want more time with?', a: who, at: '2026-11-07T00:00:00.000Z' }],
    });
    const walk = { id: 'part:walk', when: { slot: 'evening', days: ['mon'] }, order: 0, title: 'Daily walk', area: 'move', why: 'x', source: { kind: 'engine', rule: 'walk' }, status: 'active', lock: null };
    const on = () => {
      vi.stubEnv('ENGINE_CLAUDE', 'on');
      vi.stubEnv('ANTHROPIC_API_KEY', 'test');
    };
    it('keeps the promise the study made: room for who they want more time with', async () => {
      on();
      compose.mockResolvedValue({ from: 'claude', parts: [walk] });
      const { parts } = await (await post({ progress: asked('Friends') }, { 'x-real-ip': 'a' })).json();
      expect(parts.map((p: { title: string }) => p.title)).toEqual(['Daily walk', 'Time with friends']);
    });
    it('does not add it twice when Claude already made room', async () => {
      on();
      compose.mockResolvedValue({ from: 'claude', parts: [walk, { ...walk, id: 'part:f', title: 'A night out with friends' }] });
      const { parts } = await (await post({ progress: asked('Friends') }, { 'x-real-ip': 'b' })).json();
      expect(parts.map((p: { title: string }) => p.title)).toEqual(['Daily walk', 'A night out with friends']);
    });
    it('leaves the rules to speak when Claude did not shape it', async () => {
      on();
      compose.mockResolvedValue({ from: 'rules', parts: [walk] });
      expect(await (await post({ progress: asked('Friends') }, { 'x-real-ip': 'c' })).json()).toEqual({ parts: null });
    });
  });
});
