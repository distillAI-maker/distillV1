import { describe, expect, it } from 'vitest';
import { POST } from '../app/api/event/route';
import { eventSchema, screens, studyScreens } from './funnel';

const device = 'd8ca8bb8-d910-4e3a-bee2-a3bacbdda0ba';

describe('funnel events', () => {
  it('take a known step, a device id, a source and a few small counts', () => {
    expect(
      eventSchema.safeParse({ event: 'number_seen', device, source: 'class', props: { count: 8 } })
        .success,
    ).toBe(true);
  });

  it('refuse anything else: unknown steps, free text, long values, extra fields', () => {
    for (const bad of [
      { event: 'note_text', device },
      { event: 'started', device: 'x' },
      { event: 'started', device, source: 'https://evil.example' },
      { event: 'started', device, props: { note: 'a'.repeat(41) } },
      { event: 'started', device, email: 'a@b.co' },
    ])
      expect(eventSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
  });

  it('take a screen only by a known id, with the screen before it and a time within reason', () => {
    const ok = [
      { event: 'screen', device, props: { s: 'opener' } },
      { event: 'screen', device, props: { s: 'study_day', prev: 'study_keep', ms: 8400, in: true } },
      { event: 'left', device, props: { s: 'reveal_wait', ms: 12_000 } },
    ];
    for (const e of ok) expect(eventSchema.safeParse(e).success, JSON.stringify(e)).toBe(true);
    const bad = [
      { event: 'screen', device },
      { event: 'screen', device, props: { s: 'the-best-screen' } },
      { event: 'screen', device, props: { s: 'name', prev: '/admin' } },
      { event: 'left', device, props: { s: 'name', ms: -1 } },
      { event: 'left', device, props: { s: 'name', ms: 2 * 60 * 60_000 } },
      { event: 'screen', device, props: { s: 'name', ms: '12' } },
    ];
    for (const e of bad) expect(eventSchema.safeParse(e).success, JSON.stringify(e)).toBe(false);
  });

  it('name every screen once, the study in its page order, and fit the 40-character limit', () => {
    const ids = screens.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.length).toBeLessThanOrEqual(40);
    expect(studyScreens).toHaveLength(7);
    for (const s of studyScreens) expect(ids).toContain(s);
  });

  it('answers 204 whatever happens, and ignores other sites', async () => {
    const send = (origin: string) =>
      POST(
        new Request('https://distill.test/api/event', {
          method: 'POST',
          headers: { origin, 'content-type': 'application/json' },
          body: JSON.stringify({ event: 'started', device }),
        }),
      );
    expect((await send('https://distill.test')).status).toBe(204);
    expect((await send('https://elsewhere.test')).status).toBe(204);
  });
});
