// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProgressProvider } from '../../lib/progress/context';
import { LocalProgressStore } from '../../lib/progress/local';
import { emptyProgress } from '../../lib/progress/types';
import { Arrival } from './arrival';

const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace, back: vi.fn() }) }));
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
  // Let progress load.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
}

describe('Arrival', () => {
  afterEach(cleanup);
  beforeEach(() => {
    push.mockClear();
    replace.mockClear();
  });

  it('opens still on the line, and Begin goes to the name', async () => {
    await arrive();
    expect(screen.getByRole('heading', { name: "There's so much noise." })).toBeTruthy();
    expect(screen.getByText('Doing everything wears you down.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Begin/ }));
    expect(push).toHaveBeenCalledWith('/name');
  });

  it('picks up where someone coming back left off', async () => {
    await arrive({ ...emptyProgress(), step: 'study', updatedAt: new Date().toISOString() });
    fireEvent.click(screen.getByRole('button', { name: /Pick up where you left off/ }));
    expect(push).toHaveBeenCalledWith('/study');
  });

  it('signs in an existing account', async () => {
    await arrive();
    fireEvent.click(screen.getByRole('button', { name: 'I already have an account' }));
    expect(push).toHaveBeenCalledWith('/sign-in');
  });

  it('takes someone already through onboarding straight to their Ritual', async () => {
    await arrive({ ...emptyProgress(), step: 'done', updatedAt: new Date().toISOString() });
    expect(replace).toHaveBeenCalledWith('/ritual');
    expect(screen.queryByRole('button', { name: /Begin|Pick up/ })).toBeNull();
  });
});
