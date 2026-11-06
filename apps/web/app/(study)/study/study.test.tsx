// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProgressProvider } from '../../../lib/progress/context';
import { LocalProgressStore } from '../../../lib/progress/local';
import { emptyProgress, type Progress } from '../../../lib/progress/types';
import { Study } from './study';

const router = { push: vi.fn(), back: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const shape = vi.fn(async () => null);
vi.mock('../../../lib/engine/first-ritual', () => ({ shapeFirstRitual: () => shape() }));

function memory() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

async function mount(progress: Progress) {
  const store = new LocalProgressStore(memory());
  await store.save({ ...progress, updatedAt: new Date().toISOString() });
  render(
    <ProgressProvider store={store}>
      <Study names={{}} />
    </ProgressProvider>,
  );
}

/** Someone who has answered the first three screens, so it opens on "When it's a lot". */
const afterRhythm = (): Progress => ({
  ...emptyProgress(),
  step: 'study',
  name: 'Maya',
  asks: [
    { q: 'What time are you usually up?', a: '07:00', at: '2026-11-05T08:00:00.000Z' },
    { q: 'What time are you usually in bed?', a: '23:00', at: '2026-11-05T08:00:00.000Z' },
  ],
});

describe('the study', () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
    shape.mockClear();
  });

  it('never moves on by itself: the line and the button come with the tap, and the button moves on', async () => {
    await mount(afterRhythm());
    await screen.findByRole('heading', { name: /what do you reach for/i });
    expect(screen.queryByRole('button', { name: /That's me/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Scrolling' }));
    // Both at once, from the same tap.
    expect(await screen.findByText('Then hard evenings get somewhere better to land.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /That's me/ })).toBeTruthy();

    // Long past the old wait, it's still here.
    await act(async () => void (await new Promise((r) => setTimeout(r, 1300))));
    expect(screen.getByRole('heading', { name: /what do you reach for/i })).toBeTruthy();

    // Another answer changes the line, and the button stays.
    fireEvent.click(screen.getByRole('button', { name: 'Sleeping in' }));
    expect(await screen.findByText('Then mornings bend when you need them to.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /That's me/ }));
    await screen.findByRole('heading', { name: /what goes first/i });
    expect(screen.queryByText('Then your sleep is the one thing we protect.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sleep' }));
    expect(await screen.findByText('Then your sleep is the one thing we protect.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /That's the one/ }));
    await screen.findByRole('heading', { name: /more time/i });
    fireEvent.click(screen.getByRole('button', { name: 'Friends' }));
    expect(shape).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: /More of that/ }));

    // The read, with no eyebrow over it, and their Ritual starting to take shape behind it.
    await screen.findByRole('heading', { name: /you sleep in/i });
    expect(screen.queryByText("Here's what we heard")).toBeNull();
    await waitFor(() => expect(shape).toHaveBeenCalledTimes(1));
  });

  it('asks plainly: social media, with nothing under the questions', async () => {
    await mount({
      ...emptyProgress(),
      step: 'study',
      items: [{ id: 'a', itemKey: null, customName: 'AG1', monthlyCost: 90, answers: {}, chips: {}, unknown: [], status: 'listed', notes: [], position: 0 }],
    });
    await screen.findByRole('heading', { name: 'Be honest. Which of these came from social media?' });
    expect(screen.queryByText(/No judgement/)).toBeNull();
    expect(screen.queryByText(/instinctive answer/)).toBeNull();
  });
});
