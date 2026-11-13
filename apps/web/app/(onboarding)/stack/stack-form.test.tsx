// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { catalog } from '../../../lib/catalog/server';
import { env } from '../../../lib/env';
import { ProgressProvider } from '../../../lib/progress/context';
import { LocalProgressStore } from '../../../lib/progress/local';
import { emptyProgress } from '../../../lib/progress/types';
import { buildIndex } from '../../../lib/search/index';
import { StackForm } from './stack-form';

const push = vi.fn();
const router = { push, back: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const index = buildIndex(catalog);

function memory() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

describe('Your stack', () => {
  afterEach(cleanup);
  beforeEach(() => {
    env.devTools = false;
    push.mockClear();
    document.documentElement.dataset.motion = 'reduce';
  });

  it('adds from the search, sets a cost, removes, and goes on', async () => {
    const store = new LocalProgressStore(memory());
    await store.save({ ...emptyProgress(), step: 'stack', updatedAt: new Date().toISOString() });
    render(
      <ProgressProvider store={store}>
        <StackForm index={index} />
      </ProgressProvider>,
    );
    // Nothing tapped yet: past the first page of taps, "Skip to my list" goes straight to the list.
    fireEvent.click(await screen.findByRole('button', { name: /Continue/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip to my list' }));
    const box = await screen.findByRole('combobox');
    fireEvent.change(box, { target: { value: 'ag1' } });
    const option = await screen.findByRole('option', { name: /Greens powder/ });
    expect(option).toBeTruthy();
    fireEvent.keyDown(box, { key: 'Enter' });
    const row = (await screen.findByText('Greens powder')).closest('li') as HTMLElement;
    expect(row).toBeTruthy();
    // Where it came from is asked later, in the app; the list keeps only the cost.
    expect(within(row).queryByRole('button', { name: 'Where did this come from?' })).toBeNull();

    const cost = within(row).getByLabelText('Monthly cost of Greens powder') as HTMLInputElement;
    expect(cost.value).toBe('90');
    fireEvent.change(cost, { target: { value: '50' } });
    await waitFor(async () => expect((await store.load())?.items[0]?.monthlyCost).toBe(50));

    fireEvent.change(box, { target: { value: 'ag1' } });
    expect((await screen.findByRole('option', { name: /Greens powder/ })).textContent).toContain(
      'Already listed',
    );

    fireEvent.keyDown(box, { key: 'Escape' });
    fireEvent.click(within(row).getByRole('button', { name: 'Remove Greens powder' }));
    expect(screen.queryByText('Greens powder')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /That's everything/ }));
    expect(screen.getByRole('alert').textContent).toBe('Add at least one thing to go on.');
    expect(push).not.toHaveBeenCalled();

    fireEvent.change(box, { target: { value: 'equinox' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await screen.findByText('Premium gym');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /That's everything/ }));
    });
    expect(push).toHaveBeenCalledWith('/number');
    await waitFor(async () => {
      const saved = await store.load();
      expect(saved?.step).toBe('number');
      expect(saved?.items.map((i) => i.itemKey)).toEqual([
        'premium-gym-membership-equinox-life-time',
      ]);
    });
  });

  it('finds the essentials in what they say, then takes something not listed', async () => {
    const store = new LocalProgressStore(memory());
    render(
      <ProgressProvider store={store}>
        <StackForm index={index} />
      </ProgressProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Rather talk it through?' }));
    fireEvent.change(await screen.findByLabelText('Tell us what you already do for yourself'), {
      target: { value: 'I go to Equinox and take AG1 most mornings' },
    });
    expect(screen.getByText('We recognise 2 things so far.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Find my essentials/ }));
    expect(await screen.findByText('AG1')).toBeTruthy();
    expect(screen.getByText('Equinox')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Add something not listed/ }));
    fireEvent.change(screen.getByLabelText('What is it?'), { target: { value: 'Oura ring' } });
    fireEvent.change(screen.getByLabelText('a month'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add it' }));
    // What they pay for sits in one list, biggest first; free things are chips of their own.
    const paid = screen.getByRole('region', { name: 'Each month' });
    expect(within(paid).getAllByRole('listitem').map((li) => li.textContent?.split('$')[0])).toEqual([
      'Equinox',
      'AG1',
      'Oura ring',
    ]);
    await waitFor(async () => expect((await store.load())?.items).toHaveLength(3));
  });

  it('starts with the common things to tap: on adds at the table cost, off takes it out', async () => {
    const store = new LocalProgressStore(memory());
    render(
      <ProgressProvider store={store}>
        <StackForm index={index} />
      </ProgressProvider>,
    );
    // Three short pages, each one screen: what they take, what they pay for, what else they do.
    expect(await screen.findByRole('heading', { name: 'What do you take?' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Gym' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Creatine' }));
    fireEvent.click(screen.getByRole('button', { name: 'AG1 or greens' }));
    fireEvent.click(screen.getByRole('button', { name: 'AG1 or greens' }));
    expect(screen.getByRole('button', { name: 'Creatine' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('tab', { name: 'What else do you do?' }));
    expect(screen.getByRole('heading', { name: 'What else do you do?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Daily walk' }));
    // A page tapped earlier remembers what's on.
    fireEvent.click(screen.getByRole('tab', { name: 'What do you take?' }));
    expect(screen.getByRole('button', { name: 'Creatine' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('tab', { name: 'What else do you do?' }));
    await waitFor(async () => {
      const saved = await store.load();
      expect(saved?.items.map((i) => [i.itemKey, i.monthlyCost])).toEqual([
        ['creatine-monohydrate', 14],
        ['10-000-steps-daily-walk', 0],
      ]);
    });
    // Continue on the last page goes to the list.
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    // A chip that names one thing keeps that name in the list.
    expect(await screen.findByText('Creatine')).toBeTruthy();
  });

  it('leaves out the running total, so the number stays for its own screen', async () => {
    env.devTools = true;
    const store = new LocalProgressStore(memory());
    render(
      <ProgressProvider store={store}>
        <StackForm index={index} />
      </ProgressProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Try it with an example stack' }));
    await screen.findByText('Prefilled from the demo person. Change anything.');
    expect(screen.queryByText(/things · \$/)).toBeNull();
    expect(screen.queryByRole('button', { name: "I'd rather choose them myself" })).toBeNull();
  });

  it('offers the example stack on a blank start to the team only, with no feed picks and no wearable', async () => {
    env.devTools = true;
    const store = new LocalProgressStore(memory());
    await store.save({ ...emptyProgress(), step: 'stack', updatedAt: new Date().toISOString() });
    render(
      <ProgressProvider store={store}>
        <StackForm index={index} />
      </ProgressProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Try it with an example stack' }));
    expect(
      await screen.findByText('Prefilled from the demo person. Change anything.'),
    ).toBeTruthy();
    expect(screen.queryByText('Oura ring')).toBeNull();
    expect(screen.queryByText('Not listed')).toBeNull();
    await waitFor(async () => {
      const saved = await store.load();
      expect(saved?.prefilledFrom).toBe('demo');
      expect(saved?.items).toHaveLength(20);
      expect(saved?.items.reduce((t, i) => t + i.monthlyCost, 0)).toBe(1422);
      expect(saved?.items.some((i) => i.origin === 'online')).toBe(false);
    });
  });

  it('never offers the example stack to people', async () => {
    const store = new LocalProgressStore(memory());
    render(
      <ProgressProvider store={store}>
        <StackForm index={index} />
      </ProgressProvider>,
    );
    expect(await screen.findByRole('heading', { name: 'What do you take?' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try it with an example stack' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip to my list' }));
    await screen.findByRole('combobox');
    expect(screen.queryByRole('button', { name: 'Try it with an example stack' })).toBeNull();
  });

  it('opens Gym into which gym, and a specific gym stands in for the general one', async () => {
    const store = new LocalProgressStore(memory());
    render(
      <ProgressProvider store={store}>
        <StackForm index={index} />
      </ProgressProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: /Continue/ }));
    const gym = screen.getByRole('button', { name: 'Gym' });
    expect(gym.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Equinox' })).toBeNull();
    fireEvent.click(gym);
    expect(gym.getAttribute('aria-expanded')).toBe('true');
    const which = screen.getByRole('group', { name: 'Which gym?' });
    for (const name of ['Equinox', "Barry's", 'Planet Fitness', '24 Hour Fitness', 'LA Fitness', 'Other'])
      expect(within(which).getByRole('button', { name })).toBeTruthy();
    await waitFor(async () =>
      expect((await store.load())?.items.map((i) => [i.itemKey, i.label])).toEqual([['gym-membership', 'Gym']]),
    );

    fireEvent.click(within(which).getByRole('button', { name: 'Planet Fitness' }));
    await waitFor(async () =>
      expect((await store.load())?.items.map((i) => [i.itemKey, i.label, i.monthlyCost])).toEqual([
        ['gym-membership', 'Planet Fitness', 15],
      ]),
    );
    expect(within(which).getByRole('button', { name: "Barry's" }).getAttribute('aria-pressed')).toBe('false');
    expect(gym.getAttribute('aria-pressed')).toBe('true');

    // Other asks for the name; the chip wears it, and tapping it again takes it out.
    fireEvent.click(within(which).getByRole('button', { name: 'Other' }));
    const name = within(which).getByRole('textbox', { name: 'Which gym?' });
    fireEvent.change(name, { target: { value: 'YMCA' } });
    fireEvent.blur(name);
    await waitFor(async () =>
      expect((await store.load())?.items.map((i) => [i.itemKey, i.label, i.monthlyCost])).toEqual([
        ['gym-membership', 'Planet Fitness', 15],
        ['gym-membership', 'YMCA', 60],
      ]),
    );
    fireEvent.click(within(which).getByRole('button', { name: 'YMCA' }));
    await waitFor(async () => expect((await store.load())?.items.map((i) => i.label)).toEqual(['Planet Fitness']));
    expect(within(which).getByRole('button', { name: 'Other' }).getAttribute('aria-pressed')).toBe('false');

    // Class-based exercise opens the same way; yoga on its own stays a chip of its own.
    fireEvent.click(screen.getByRole('button', { name: 'Class-based exercise' }));
    const classes = screen.getByRole('group', { name: 'Which classes?' });
    for (const name of ['Yoga studio', 'Pilates', 'SoulCycle', 'F45', 'ClassPass', 'Other'])
      expect(within(classes).getByRole('button', { name })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Yoga' }).getAttribute('aria-expanded')).toBeNull();

    // Off again takes the whole family out.
    fireEvent.click(gym);
    expect(screen.queryByRole('group', { name: 'Which gym?' })).toBeNull();
    await waitFor(async () =>
      expect((await store.load())?.items.map((i) => i.label)).toEqual(['Class-based exercise']),
    );
  });
});
