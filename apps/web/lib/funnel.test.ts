import { describe, expect, it } from 'vitest';
import { POST } from '../app/api/event/route';
import { eventSchema } from './funnel';

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
