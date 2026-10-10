// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { catalog } from '../../../lib/catalog/server';
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
    // Nothing said yet: "Find my essentials" goes straight to the list.
    fireEvent.click(await screen.findByRole('button', { name: /Find my essentials/ }));
    const box = await screen.findByRole('combobox');
    fireEvent.change(box, { target: { value: 'ag1' } });
    const option = await screen.findByRole('option', { name: /Greens powder/ });
    expect(option).toBeTruthy();
    fireEvent.keyDown(box, { key: 'Enter' });
    const row = (await screen.findByText('Greens powder (AG1 etc.)')).closest('li') as HTMLElement;
    expect(row).toBeTruthy();
    // Where it came from is asked later, in the app; the list keeps only the cost.
    expect(within(row).queryByRole('button', { name: 'Where did this come from?' })).toBeNull();

    const cost = within(row).getByLabelText(
      'Monthly cost of Greens powder (AG1 etc.)',
    ) as HTMLInputElement;
    expect(cost.value).toBe('90');
    fireEvent.change(cost, { target: { value: '50' } });
    await waitFor(async () => expect((await store.load())?.items[0]?.monthlyCost).toBe(50));

    fireEvent.change(box, { target: { value: 'ag1' } });
    expect((await screen.findByRole('option', { name: /Greens powder/ })).textContent).toContain(
      'Already listed',
    );

    fireEvent.keyDown(box, { key: 'Escape' });
    fireEvent.click(within(row).getByRole('button', { name: 'Remove Greens powder (AG1 etc.)' }));
    expect(screen.queryByText('Greens powder (AG1 etc.)')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /That's everything/ }));
    expect(screen.getByRole('alert').textContent).toBe('Add at least one thing to go on.');
    expect(push).not.toHaveBeenCalled();

    fireEvent.change(box, { target: { value: 'equinox' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await screen.findByText('Premium gym membership (Equinox, Life Time)');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /That's everything/ }));
    });
    expect(push).toHaveBeenCalledWith('/life');
    await waitFor(async () => {
      const saved = await store.load();
      expect(saved?.step).toBe('life');
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
    fireEvent.change(await screen.findByLabelText('Tell us what you already do for yourself'), {
      target: { value: 'I go to Equinox and take AG1 most mornings' },
    });
    expect(screen.getByText('We recognise 2 things so far.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Find my essentials/ }));
    expect(await screen.findByText('Greens powder (AG1 etc.)')).toBeTruthy();
    expect(screen.getByText('Premium gym membership (Equinox, Life Time)')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Add something not listed/ }));
    fireEvent.change(screen.getByLabelText('What is it?'), { target: { value: 'Oura ring' } });
    fireEvent.change(screen.getByLabelText('a month'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add it' }));
    expect(screen.getByText('Oura ring')).toBeTruthy();
    expect(screen.getByText('Not listed')).toBeTruthy();
    await waitFor(async () => expect((await store.load())?.items).toHaveLength(3));
  });

  it('leaves out the running total, so the number stays for its own screen', async () => {
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

  it('offers the example stack on a blank start', async () => {
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
    expect(screen.getByText('Your data source')).toBeTruthy();
    await waitFor(async () => {
      const saved = await store.load();
      expect(saved?.prefilledFrom).toBe('demo');
      expect(saved?.items).toHaveLength(21);
      expect(saved?.items.reduce((t, i) => t + i.monthlyCost, 0)).toBe(1428);
    });
  });
});
