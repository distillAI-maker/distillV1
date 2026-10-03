// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { catalog } from '../../lib/catalog/server';
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
const iso = (d: Date) => d.toISOString().slice(0, 10);

function startedProgress(): Progress {
  const p: Progress = { ...emptyProgress(), step: 'done', dataSource: 'demo', goals: demoGoals, items: demoStack(), updatedAt: new Date().toISOString() };
  p.dayOne = { ...p.dayOne, started: true, months: 8 };
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

  it('asks for one tap on day 14, then offers the verdict; a night can be left out', async () => {
    const store = new LocalProgressStore(memory());
    await store.save(startedProgress());
    render(
      <ProgressProvider store={store}>
        <Today loadTemplates={loadTemplates} />
      </ProgressProvider>,
    );
    expect(await screen.findByText('Day 14 of 14 · an off day')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Today: no coffee after 2pm.' })).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Fourteen days, three on and three off' }).children).toHaveLength(14);
    expect(screen.getByRole('listitem', { name: 'Day 9, on, unknown' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: "Don't count last night" }));
    fireEvent.click(screen.getByRole('radio', { name: 'Ill' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Leave it out' }));
    });
    expect(screen.getByText('Last night is left out.')).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Did it' }));
    });
    expect(await screen.findByText('Your verdict is ready.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Read the verdict' }).getAttribute('href')).toBe(`/verdicts/${demoExperimentId}`);
    await waitFor(async () => {
      const saved = await store.load();
      expect(saved?.taps[demoExperimentId]?.[iso(today)]).toEqual({ value: 'did' });
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      expect(saved?.taps[demoExperimentId]?.[iso(y)]?.excluded).toBe('Ill');
    });
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
  it('shows the number, the swing, the word and the template sentence, and takes the decision', async () => {
    const store = new LocalProgressStore(memory());
    const p = startedProgress();
    p.taps = { [demoExperimentId]: { [iso(today)]: { value: 'did' } } };
    await store.save(p);
    render(
      <ProgressProvider store={store}>
        <VerdictView id={demoExperimentId} loadTemplates={loadTemplates} />
      </ProgressProvider>,
    );
    expect(await screen.findByText('14 days, 13 taps.')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('−51 min');
    expect(screen.getByText('Dropped', { selector: '.word' })).toBeTruthy();
    expect(screen.getByText(/Coffee after 2pm: your total sleep was 51 minutes worse/)).toBeTruthy();
    expect(screen.getByText('40 min')).toBeTruthy();
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
    const p = startedProgress();
    p.taps = { [demoExperimentId]: { [iso(today)]: { value: 'did' } } };
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
