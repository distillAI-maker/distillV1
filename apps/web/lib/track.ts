import { useEffect } from 'react';
import { MAX_SCREEN_MS, type EventInput, type FunnelEvent, type ScreenId } from './funnel';
import { newItemId } from './progress/types';

/** Steps counted once per device: reaching them is what the milestone counts measure. */
const once = new Set<FunnelEvent>([
  'arrived',
  'started',
  'stack_done',
  'number_seen',
  'joined',
  'home_opened',
]);

/** Set on a team phone from the funnel page (app/team), so our own testing never counts. */
export const NOT_COUNTED_KEY = 'distill.count';

let signedIn = false;
/** The progress provider says whether this is a signed-in account; each count carries a yes/no. */
export function setSignedIn(on: boolean) {
  signedIn = on;
}

/**
 * Counts a step of the funnel (lib/funnel.ts) for this device, tagged with where they came from
 * (?src= on the first visit, kept by the boot script in app/layout.tsx). Best effort and silent.
 */
export function track(event: FunnelEvent, props: EventInput['props'] = {}) {
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') return;
  try {
    if (localStorage.getItem(NOT_COUNTED_KEY) === 'off') return;
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
    const body: EventInput = {
      event,
      device,
      props: signedIn ? { ...props, in: true } : props,
      ...(source ? { source } : {}),
    };
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

type Visit = { id: ScreenId; since: number | null; spent: number };

/**
 * Time on each screen, counted only while the page is in view. `enter` gives what to send when a
 * screen shows (the screen, and the one before with its time), `hide` what to send when the page
 * is hidden or closed, and `show` resumes the clock when they come back.
 */
export class ScreenClock {
  private visit: Visit | null = null;

  enter(id: ScreenId, now: number): { s: ScreenId; prev?: ScreenId; ms?: number } | null {
    // The same screen drawn again (a re-render, Strict Mode, a reload of state) is one visit.
    if (this.visit?.id === id) return null;
    const before = this.visit;
    this.visit = { id, since: now, spent: 0 };
    if (!before) return { s: id };
    const ms = Math.round(before.spent + (before.since === null ? 0 : now - before.since));
    return ms <= MAX_SCREEN_MS ? { s: id, prev: before.id, ms } : { s: id, prev: before.id };
  }

  hide(now: number): { s: ScreenId; ms: number } | null {
    const v = this.visit;
    if (!v || v.since === null) return null;
    v.spent += now - v.since;
    v.since = null;
    return { s: v.id, ms: Math.round(Math.min(v.spent, MAX_SCREEN_MS)) };
  }

  show(now: number) {
    if (this.visit && this.visit.since === null) this.visit.since = now;
  }
}

const clock = new ScreenClock();
let watching = false;

/** Counts a screen showing, and from then on, the page being hidden or closed on it. */
export function trackScreen(id: ScreenId) {
  if (typeof window === 'undefined') return;
  if (!watching) {
    watching = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        const left = clock.hide(performance.now());
        if (left) track('left', left);
      } else clock.show(performance.now());
    });
  }
  const shown = clock.enter(id, performance.now());
  if (shown) track('screen', shown);
}

/** Counts this screen while it shows. Null (still loading) counts nothing yet. */
export function useScreen(id: ScreenId | null | undefined) {
  useEffect(() => {
    if (id) trackScreen(id);
  }, [id]);
}
