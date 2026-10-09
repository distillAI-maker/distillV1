// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { catalog } from '../../lib/catalog/server';
import { createDemoSource } from '../../lib/data/demo';
import { demoExperimentId } from '../../lib/data/demo/experiments';
import { demoGoals, demoStack } from '../../lib/data/demo/stack';
import { ProgressProvider } from '../../lib/progress/context';
import { LocalProgressStore } from '../../lib/progress/local';
import { emptyProgress } from '../../lib/progress/types';
import type { Progress } from '../../lib/progress/types';
import { FileView } from './file/file-view';
import { SettingsView } from './settings/settings-view';
import { Today } from './today/today';
import { VerdictView } from './verdicts/verdict-view';

const push = vi.fn();
const router = { push, back: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/today' }));

const byKey = new Map(catalog.items.map((i) => [i.key, i]));
const loadItems = async (keys: string[]) => keys.map((k) => byKey.get(k)).filter((i) => i !== undefined);
const loadTemplates = async () => catalog.verdictTemplates;

function memory() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  };
}
const today = new Date();
today.setHours(12, 0, 0, 0);
/** The demo's nights at a given stage (0: day 14, 2: day 28), from the engine-driven source. */
async function demoNightsAt(progress: Progress, stage: 0 | 1 | 2) {
  const [exp] = await createDemoSource(undefined, today).experiments({ ...progress, demoSkipDays: stage });
  return exp!.nights!;
}

/**
 * Day one done and the first reading started. With no pick of the person's own the demo runs the
 * engine's first item, alcohol (observed, too close at the first read); picking coffee runs an
 * assigned test that is clear at day 14.
 */
function startedProgress(firstExperiment?: string): Progress {
  const p: Progress = { ...emptyProgress(), step: 'done', dataSource: 'demo', goals: demoGoals, items: demoStack(), updatedAt: new Date().toISOString() };
  p.dayOne = { ...p.dayOne, started: true, months: 8, firstExperiment };
  p.items = p.items.map((i) => {
    if (i.itemKey === 'coffee-after-2pm' || i.itemKey === 'alcohol-in-the-evening' || i.itemKey === 'training-after-7pm' || i.itemKey === 'late-dinner-within-2-3-h-of-bed')
      return { ...i, status: 'testing' };
    if (['premium-gym-membership-equinox-life-time', 'fitness-app-subscription-peloton-app-apple-fitness-ladder', 'retinol-retinoid-nightly', 'sunscreen-daily-spf-30'].includes(i.itemKey ?? ''))
      return { ...i, status: 'kept' };
    if (i.dataSource) return { ...i, status: 'protected' };
    if (['greens-powder-ag1-etc', 'facials-monthly'].includes(i.itemKey ?? '')) return i;
    return { ...i, status: 'cut' };
  });
  return p;
}

describe('Today', () => {
  afterEach(cleanup);
  beforeEach(() => {
    push.mockClear();
    document.documentElement.dataset.motion = 'reduce';
  });

  it('asks for one tap on day 14, says it is too close, and reaches the verdict by day 28', async () => {
    const store = new LocalProgressStore(memory());
    await store.save(startedProgress());
    const first = await demoNightsAt(startedProgress(), 0);
    render(
      <ProgressProvider store={store}>
        <Today loadTemplates={loadTemplates} />
      </ProgressProvider>,
    );
    // The engine's first pick is alcohol: observed nights, so the label says so.
    expect(await screen.findByText('Observation day 14 of 14')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /drink/i })).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Fourteen days, three on and three off' }).children).toHaveLength(14);

    fireEvent.click(screen.getByRole('button', { name: "Don't count last night" }));
    fireEvent.click(screen.getByRole('radio', { name: 'Ill' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Leave it out' }));
    });
    expect(screen.getByText('Last night is left out.')).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Did it' }));
    });
    // A modest effect rarely clears the bar in a fortnight: the engine asks for one more week.
    expect(await screen.findByText('Too close to call yet.')).toBeTruthy();
    await waitFor(async () => {
      const saved = await store.load();
      expect(saved?.taps[demoExperimentId]?.[first.at(-1)!.date]).toEqual({ value: 'did' });
      expect(saved?.taps[demoExperimentId]?.[first.at(-2)!.date]?.excluded).toBe('Ill');
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Skip ahead a week (demo)' }));
    });
    expect(await screen.findByText('Observation day 21 of 21')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Did it' }));
    });
    expect(await screen.findByText('Too close to call yet.')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Skip ahead a week (demo)' }));
    });
    expect(await screen.findByText('Observation day 28 of 28')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Did it' }));
    });
    expect(await screen.findByText('Your verdict is ready.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Read the verdict' }).getAttribute('href')).toBe(`/verdicts/${demoExperimentId}`);
  });

  it('reaches a verdict at the first read when the effect is clear', async () => {
    const store = new LocalProgressStore(memory());
    await store.save(startedProgress('coffee-after-2pm'));
    render(
      <ProgressProvider store={store}>
        <Today loadTemplates={loadTemplates} />
      </ProgressProvider>,
    );
    expect(await screen.findByText(/^Day 14 of 14/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: /coffee/i })).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Did it' }));
    });
    // Two swings of lost sleep clear the bar at day 14: no extra week, the verdict is ready.
    expect(await screen.findByText('Your verdict is ready.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Skip ahead a week (demo)' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Read the verdict' }).getAttribute('href')).toBe(`/verdicts/${demoExperimentId}`);
  });

  it('shows the empty state before the first experiment starts', async () => {
    const store = new LocalProgressStore(memory());
    await store.save({ ...emptyProgress(), dataSource: 'demo', items: demoStack(), updatedAt: new Date().toISOString() });
    render(
      <ProgressProvider store={store}>
        <Today loadTemplates={loadTemplates} />
      </ProgressProvider>,
    );
    expect(await screen.findByRole('heading', { name: 'Nothing to tap today.' })).toBeTruthy();
  });
});

describe('Verdict', () => {
  afterEach(cleanup);
  it('shows the number, the swing, the word and the engine sentence, and takes the decision', async () => {
    const store = new LocalProgressStore(memory());
    // Coffee is clear at the first read, so the verdict comes after the day-14 tap.
    const p = startedProgress('coffee-after-2pm');
    const nights = await demoNightsAt(p, 0);
    p.taps = { [demoExperimentId]: { [nights.at(-1)!.date]: { value: 'did' } } };
    await store.save(p);
    render(
      <ProgressProvider store={store}>
        <VerdictView id={demoExperimentId} loadTemplates={loadTemplates} />
      </ProgressProvider>,
    );
    expect(await screen.findByText('14 days, 14 taps.')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('−71 minutes');
    expect(screen.getByText('Dropped', { selector: '.word' })).toBeTruthy();
    expect(screen.getByText('It costs you.')).toBeTruthy();
    expect(screen.getByText(/Coffee after 2pm: your total sleep was 71 minutes worse on the nights you did it/)).toBeTruthy();
    expect(screen.getByText('36 minutes')).toBeTruthy();
    expect(screen.getAllByRole('img', { name: /^Night \d+/ })).toHaveLength(14);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Let it go' }));
    });
    expect(screen.getByText('Let go. It moves to what you cut.')).toBeTruthy();
    await waitFor(async () => {
      const saved = await store.load();
      expect(saved?.verdictChoices[demoExperimentId]).toBe('cut');
      expect(saved?.items.find((i) => i.itemKey === 'coffee-after-2pm')?.status).toBe('cut');
    });
  });
});

describe('Your file', () => {
  afterEach(cleanup);
  it('counts down after day one and a verdict', async () => {
    const store = new LocalProgressStore(memory());
    const p = startedProgress('coffee-after-2pm');
    const nights = await demoNightsAt(p, 0);
    p.taps = { [demoExperimentId]: { [nights.at(-1)!.date]: { value: 'did' } } };
    p.verdictChoices = { [demoExperimentId]: 'cut' };
    p.items = p.items.map((i) => (i.itemKey === 'coffee-after-2pm' ? { ...i, status: 'cut' } : i));
    await store.save(p);
    render(
      <ProgressProvider store={store}>
        <FileView loadItems={loadItems} loadTemplates={loadTemplates} />
      </ProgressProvider>,
    );
    expect(await screen.findByText('10 things')).toBeTruthy();
    expect(screen.getByText('was 21')).toBeTruthy();
    expect(screen.getByText('$661 a month')).toBeTruthy();
    expect(screen.getByText('was $1,428')).toBeTruthy();
    const cut = screen.getByRole('region', { name: 'What you cut' });
    expect(within(cut).getAllByRole('listitem')).toHaveLength(11);
    expect(within(cut).getByText('Dropped')).toBeTruthy();
    const yours = screen.getByRole('region', { name: "What's yours" });
    expect(within(yours).getAllByText('kept on day one')).toHaveLength(4);
  });
});

describe('Settings', () => {
  afterEach(cleanup);
  it('toggles less motion, exports, and deletes everything', async () => {
    const storage = memory();
    const store = new LocalProgressStore(storage);
    await store.save(startedProgress());
    const localSet = vi.spyOn(Storage.prototype, 'setItem');
    const create = vi.fn(() => 'blob:x');
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const onDelete = vi.fn(async () => ({ status: 'nothing' as const }));
    render(
      <ProgressProvider store={store}>
        <SettingsView email={null} onDelete={onDelete} />
      </ProgressProvider>,
    );
    expect(await screen.findByText('Demo data')).toBeTruthy();
    const sw = screen.getByRole('switch', { name: /Less motion/ });
    fireEvent.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('true');
    expect(document.documentElement.dataset.motion).toBe('reduce');
    expect(localSet).toHaveBeenCalledWith('distill.motion', 'reduce');

    fireEvent.click(screen.getByRole('button', { name: 'Export my data' }));
    expect(create).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete everything' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete everything?' });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete everything' }));
    });
    expect(onDelete).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/');
    await waitFor(async () => expect(await store.load()).toBeNull());
    click.mockRestore();
    localSet.mockRestore();
  });
});
