// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProgressProvider } from '../../../lib/progress/context';
import { LocalProgressStore } from '../../../lib/progress/local';
import { emptyProgress } from '../../../lib/progress/types';
import { ConnectForm, demoNights } from './connect-form';

vi.mock('../../../lib/data/route-action', () => ({
  routeProgress: async () => ({ items: [], overlaps: [], queue: [] }),
}));

const push = vi.fn();
const router = { push, back: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

function memory() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

describe('Connect', () => {
  afterEach(cleanup);
  beforeEach(() => {
    push.mockClear();
    document.documentElement.dataset.motion = 'reduce';
    document.documentElement.style.setProperty('--motion', '0');
  });

  it('runs the demo backfill and finishes onboarding on Today', async () => {
    const store = new LocalProgressStore(memory());
    render(
      <ProgressProvider store={store}>
        <ConnectForm />
      </ProgressProvider>,
    );
    const demo = await screen.findByRole('button', { name: /Use demo data/ });
    await act(async () => {
      fireEvent.click(demo);
    });
    expect(await screen.findByText('Six months of nights, ready.')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    });
    expect(push).toHaveBeenCalledWith('/today');
    await waitFor(async () => {
      const saved = await store.load();
      expect(saved?.dataSource).toBe('demo');
      expect(saved?.backfill).toEqual({ nights: demoNights, done: true });
      expect(saved?.step).toBe('done');
      expect(saved?.dayOne.started).toBe(true);
    });
  });

  it('keeps live providers off until the flag is on', async () => {
    render(
      <ProgressProvider store={new LocalProgressStore(memory())}>
        <ConnectForm />
      </ProgressProvider>,
    );
    const oura = await screen.findByRole('button', { name: /Oura/ });
    expect((oura as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Not yet connected in this build.')).toBeTruthy();
  });

  it('lands on the finished state after a reload', async () => {
    const storage = memory();
    const store = new LocalProgressStore(storage);
    await store.save({
      ...emptyProgress(),
      dataSource: 'demo',
      backfill: { nights: demoNights, done: true },
      updatedAt: new Date().toISOString(),
    });
    render(
      <ProgressProvider store={store}>
        <ConnectForm />
      </ProgressProvider>,
    );
    expect(await screen.findByText('Six months of nights, ready.')).toBeTruthy();
  });
});
