// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { catalog } from '../../../lib/catalog/server';
import { demoGoals, demoStack } from '../../../lib/data/demo/stack';
import { ProgressProvider } from '../../../lib/progress/context';
import { LocalProgressStore } from '../../../lib/progress/local';
import { emptyProgress } from '../../../lib/progress/types';
import { DayOne } from './day-one';

const push = vi.fn();
const router = { push, back: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const byKey = new Map(catalog.items.map((i) => [i.key, i]));
const loadItems = async (keys: string[]) => keys.map((k) => byKey.get(k)).filter((i) => i !== undefined);

function memory() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

describe('Day one', () => {
  afterEach(cleanup);
  beforeEach(() => {
    push.mockClear();
    document.documentElement.dataset.motion = 'reduce';
    document.documentElement.style.setProperty('--motion', '0');
  });

  it('shows the Worked Example, lets the person keep a drop and swap the pair, then starts', async () => {
    const store = new LocalProgressStore(memory());
    await store.save({
      ...emptyProgress(),
      step: 'day-one',
      dataSource: 'demo',
      prefilledFrom: 'demo',
      goals: demoGoals,
      items: demoStack(),
      updatedAt: new Date().toISOString(),
    });
    render(
      <ProgressProvider store={store}>
        <DayOne loadItems={loadItems} />
      </ProgressProvider>,
    );
    expect(await screen.findByText('21 things.')).toBeTruthy();
    expect(screen.getByText('$1,428 a month.')).toBeTruthy();
    expect(
      screen.getByText("10 come off today, $767 a month back. 4 lined up for testing. 2 we can't measure, cost shown. 4 to keep. 1 left alone."),
    ).toBeTruthy();
    for (const title of ['No test needed', 'Tested on you', "Can't measure it", 'Keep', 'Protected'])
      expect(screen.getByRole('heading', { name: title })).toBeTruthy();

    // Every sentence is the catalog's.
    expect(screen.getByText(byKey.get('sunscreen-daily-spf-30')!.dayOne)).toBeTruthy();
    // The hypothesis from history, labelled.
    expect(screen.getByText('From your history')).toBeTruthy();

    // Keep magnesium anyway: 9 drops, $745 back.
    const mag = screen.getByRole('article', { name: 'Magnesium (any form)' });
    fireEvent.click(within(mag).getByRole('radio', { name: 'Keep it anyway' }));
    expect(screen.getByText(/9 come off today, \$745 a month back/)).toBeTruthy();

    // Swap the pair: Barry's stays, Equinox goes, $817 back.
    const pair = screen.getByRole('group', { name: 'These two do the same job.' });
    fireEvent.click(within(pair).getByRole('radio', { name: /Keep Boutique class membership/ }));
    expect(screen.getByText(/9 come off today, \$795 a month back/)).toBeTruthy();
    fireEvent.click(within(pair).getByRole('radio', { name: /Keep Premium gym membership/ }));
    expect(screen.getByText(/9 come off today, \$745 a month back/)).toBeTruthy();

    // First experiment is coffee; start it.
    expect(screen.getByText('Coffee after 2pm', { selector: '.first' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Roughly how many months has this been part of your days?'), { target: { value: '8' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start the first experiment' }));
    });
    expect(push).toHaveBeenCalledWith('/today');
    await waitFor(async () => {
      const saved = await store.load();
      expect(saved?.step).toBe('done');
      expect(saved?.dayOne.started).toBe(true);
      expect(saved?.dayOne.months).toBe(8);
      const statuses = saved?.items.map((i) => i.status) ?? [];
      expect(statuses.filter((s) => s === 'cut')).toHaveLength(9);
      expect(statuses.filter((s) => s === 'testing')).toHaveLength(4);
      expect(statuses.filter((s) => s === 'protected')).toHaveLength(1);
    });
  });

  it('lets the person pick a different first experiment', async () => {
    const store = new LocalProgressStore(memory());
    await store.save({ ...emptyProgress(), step: 'day-one', dataSource: 'demo', goals: demoGoals, items: demoStack(), updatedAt: new Date().toISOString() });
    render(
      <ProgressProvider store={store}>
        <DayOne loadItems={loadItems} />
      </ProgressProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Not this one' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Alcohol in the evening' }));
    expect(screen.getByText('Alcohol in the evening', { selector: '.first' })).toBeTruthy();
    expect(screen.getByText('Off nights only. We never assign a drink.')).toBeTruthy();
  });

  it('shows the empty state with nothing listed', async () => {
    const store = new LocalProgressStore(memory());
    await store.save({ ...emptyProgress(), step: 'day-one', dataSource: 'demo', updatedAt: new Date().toISOString() });
    render(
      <ProgressProvider store={store}>
        <DayOne loadItems={loadItems} />
      </ProgressProvider>,
    );
    expect(await screen.findByText('Nothing to read yet.')).toBeTruthy();
  });

  it('shows an error and retries when the catalog cannot be read', async () => {
    const store = new LocalProgressStore(memory());
    await store.save({ ...emptyProgress(), step: 'day-one', dataSource: 'demo', items: demoStack(), updatedAt: new Date().toISOString() });
    let calls = 0;
    const flaky = async (keys: string[]) => {
      calls += 1;
      if (calls === 1) throw new Error('down');
      return loadItems(keys);
    };
    render(
      <ProgressProvider store={store}>
        <DayOne loadItems={flaky} />
      </ProgressProvider>,
    );
    expect((await screen.findByRole('alert')).textContent).toBe("We couldn't read your stack. Nothing was lost.");
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    });
    expect(await screen.findByText('21 things.')).toBeTruthy();
  });
});
