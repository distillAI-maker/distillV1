// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProgressProvider } from '../../lib/progress/context';
import { LocalProgressStore } from '../../lib/progress/local';
import { emptyProgress } from '../../lib/progress/types';
import { Arrival } from './arrival';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, back: vi.fn() }) }));
vi.mock('../../lib/track', () => ({ track: vi.fn() }));

function memory() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

async function arrive(saved?: Parameters<LocalProgressStore['save']>[0]) {
  const store = new LocalProgressStore(memory());
  if (saved) await store.save(saved);
  render(
    <ProgressProvider store={store}>
      <Arrival />
    </ProgressProvider>,
  );
  const screenEl = screen.getByRole('button', { name: /There's so much noise/ });
  // Let progress load.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
  return screenEl;
}

describe('Arrival', () => {
  afterEach(cleanup);
  beforeEach(() => {
    push.mockClear();
    delete document.documentElement.dataset.motion;
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it('opens on the noise, clears it, then lands the line; Begin goes to the name', async () => {
    const el = await arrive();
    expect(el.className).toContain('is-noise');
    expect(el.textContent).toContain('Day 1 of 75');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(el.className).toContain('is-clear');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(el.className).toContain('is-settled');
    fireEvent.click(el);
    expect(push).toHaveBeenCalledWith('/name');
  });

  it('skips the noise on the first tap, and only begins on the second', async () => {
    const el = await arrive();
    fireEvent.click(el);
    expect(el.className).toContain('is-settled');
    expect(push).not.toHaveBeenCalled();
    fireEvent.keyDown(el, { key: 'Enter' });
    expect(push).toHaveBeenCalledWith('/name');
  });

  it('lands someone coming back straight on the line, and picks up where they left off', async () => {
    const el = await arrive({ ...emptyProgress(), step: 'best', updatedAt: new Date().toISOString() });
    expect(el.className).toContain('is-settled');
    expect(el.textContent).toContain('Pick up where you left off');
    fireEvent.click(el);
    expect(push).toHaveBeenCalledWith('/best');
  });

  it('skips the noise for anyone who asked for less motion', async () => {
    document.documentElement.dataset.motion = 'reduce';
    const el = await arrive();
    expect(el.className).toContain('is-settled');
  });
});
