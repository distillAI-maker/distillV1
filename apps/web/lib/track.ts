import type { EventInput, FunnelEvent } from './funnel';
import { newItemId } from './progress/types';

/** Steps counted once per device: reaching them is what the funnel measures. */
const once = new Set<FunnelEvent>([
  'arrived',
  'started',
  'stack_done',
  'number_seen',
  'joined',
  'home_opened',
]);

/**
 * Counts a step of the funnel (lib/funnel.ts) for this device, tagged with where they came from
 * (?src= on the first visit, kept by the boot script in app/layout.tsx). Best effort and silent.
 */
export function track(event: FunnelEvent, props: EventInput['props'] = {}) {
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') return;
  try {
    let device = localStorage.getItem('distill.device');
    if (!device) {
      device = newItemId();
      localStorage.setItem('distill.device', device);
    }
    if (once.has(event)) {
      const sent = JSON.parse(localStorage.getItem('distill.sent') ?? '[]') as string[];
      if (sent.includes(event)) return;
      localStorage.setItem('distill.sent', JSON.stringify([...sent, event]));
    }
    const source = localStorage.getItem('distill.source') ?? undefined;
    const body: EventInput = { event, device, props, ...(source ? { source } : {}) };
    void fetch('/api/event', {
      method: 'POST',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => undefined);
  } catch {
    // Counting never gets in anyone's way.
  }
}
