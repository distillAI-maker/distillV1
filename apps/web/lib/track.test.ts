import { describe, expect, it } from 'vitest';
import { MAX_SCREEN_MS } from './funnel';
import { ScreenClock } from './track';

describe('time on a screen', () => {
  it('sends the screen, and the one before with the time spent on it', () => {
    const c = new ScreenClock();
    expect(c.enter('name', 0)).toEqual({ s: 'name' });
    expect(c.enter('stack_tap', 4200)).toEqual({ s: 'stack_tap', prev: 'name', ms: 4200 });
  });

  it('counts the same screen drawn twice as one visit', () => {
    const c = new ScreenClock();
    c.enter('study_feed', 0);
    expect(c.enter('study_feed', 300)).toBeNull();
    expect(c.enter('study_keep', 5000)).toEqual({ s: 'study_keep', prev: 'study_feed', ms: 5000 });
  });

  it('only counts while the page is in view, and says where they were when it was hidden', () => {
    const c = new ScreenClock();
    c.enter('reveal_wait', 1000);
    expect(c.hide(4000)).toEqual({ s: 'reveal_wait', ms: 3000 });
    expect(c.hide(5000)).toBeNull();
    c.show(60_000);
    expect(c.hide(62_000)).toEqual({ s: 'reveal_wait', ms: 5000 });
    c.show(100_000);
    expect(c.enter('reveal', 101_000)).toEqual({ s: 'reveal', prev: 'reveal_wait', ms: 6000 });
  });

  it('leaves the time out when they were plainly away, and caps what a hidden page reports', () => {
    const c = new ScreenClock();
    c.enter('email', 0);
    expect(c.enter('email_done', MAX_SCREEN_MS + 1)).toEqual({ s: 'email_done', prev: 'email' });
    expect(c.hide(3 * MAX_SCREEN_MS)).toEqual({ s: 'email_done', ms: MAX_SCREEN_MS });
  });

  it('has nothing to say before any screen showed', () => {
    const c = new ScreenClock();
    expect(c.hide(10)).toBeNull();
    c.show(20);
    expect(c.enter('opener', 30)).toEqual({ s: 'opener' });
  });
});
