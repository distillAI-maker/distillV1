// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { catalog } from '../../../lib/catalog/server';
import { demoGoals, demoStack } from '../../../lib/data/demo/stack';
import { ProgressProvider } from '../../../lib/progress/context';
import { LocalProgressStore } from '../../../lib/progress/local';
import { emptyProgress } from '../../../lib/progress/types';
import { QuestionsFlow } from './questions-flow';

const push = vi.fn();
const router = { push, back: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

/** The three item questions the demo person sees: two by money at stake, then the habit most worth reading. */
const DEMO_HEADINGS = [
  'Premium gym membership: how many times in the last 30 days?',
  'Recovery studio membership: how many times in the last 30 days?',
  'Alcohol in the evening: how many nights a week, usually?',
];

const byKey = new Map(catalog.items.map((i) => [i.key, i]));
const loadItems = async (keys: string[]) =>
  keys.map((k) => byKey.get(k)).filter((i) => i !== undefined);

function memory() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

describe('Follow-ups', () => {
  afterEach(cleanup);
  beforeEach(() => {
    push.mockClear();
    document.documentElement.dataset.motion = 'reduce';
  });

  it('asks the demo person three item questions, biggest money first, and lands on the number', async () => {
    const store = new LocalProgressStore(memory());
    await store.save({
      ...emptyProgress(),
      step: 'questions',
      seenQuestions: ['person:doctor', 'person:keep'],
      dataSource: 'demo',
      prefilledFrom: 'demo',
      goals: demoGoals,
      items: demoStack(),
      updatedAt: new Date().toISOString(),
    });
    render(
      <ProgressProvider store={store}>
        <QuestionsFlow loadItems={loadItems} />
      </ProgressProvider>,
    );
    // The item sits inside the question; no label above it and no "Question k of n".
    expect(
      await screen.findByRole('heading', {
        name: 'Premium gym membership: how many times in the last 30 days?',
      }),
    ).toBeTruthy();
    expect(screen.queryByText(/Question \d+ of/)).toBeNull();
    expect(screen.getByRole('radio', { name: '8 or more' }).getAttribute('aria-checked')).toBe(
      'true',
    );

    const headings: string[] = [];
    for (let i = 0; i < 10; i++) {
      const h = await screen.findByRole('heading', { level: 1 });
      headings.push(h.textContent ?? '');
      const cta =
        screen.queryByRole('button', { name: "That's right" }) ??
        screen.getByRole('button', { name: 'Continue' });
      await act(async () => {
        fireEvent.click(cta);
      });
      if (push.mock.calls.length) break;
    }
    expect(headings).toEqual(DEMO_HEADINGS);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/number'));
    await waitFor(async () => {
      const saved = await store.load();
      expect(saved?.step).toBe('number');
      // Two about the person, three about items: five in all.
      expect(saved?.seenQuestions).toHaveLength(5);
    });
  });

  it('asks a fresh item its questions and records "not sure" honestly', async () => {
    const store = new LocalProgressStore(memory());
    await store.save({
      ...emptyProgress(),
      step: 'questions',
      seenQuestions: ['person:doctor', 'person:keep'],
      goals: ['sleep (general)'],
      items: [
        {
          id: 'a',
          itemKey: 'cbd',
          monthlyCost: 40,
          origin: 'online',
          answers: {},
          chips: {},
          unknown: [],
          status: 'listed',
          position: 0,
        },
      ],
      updatedAt: new Date().toISOString(),
    });
    render(
      <ProgressProvider store={store}>
        <QuestionsFlow loadItems={loadItems} />
      </ProgressProvider>,
    );
    expect(
      await screen.findByRole('heading', { name: /: are you on any prescription medication\?$/ }),
    ).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    });
    expect(screen.getByRole('alert').textContent).toBe('Pick one to go on.');
    fireEvent.click(screen.getByRole('radio', { name: 'Not sure' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/number'));
    await waitFor(async () => {
      const saved = await store.load();
      expect(saved?.items[0]?.unknown).toEqual(['onMedication']);
      expect(saved?.items[0]?.answers).toEqual({});
    });
  });

  it('drops a stored dose when the form changes, so the unit is asked again', async () => {
    const store = new LocalProgressStore(memory());
    await store.save({
      ...emptyProgress(),
      step: 'questions',
      seenQuestions: ['person:doctor', 'person:keep'],
      goals: [],
      items: [
        {
          id: 't',
          itemKey: 'tart-cherry-juice-extract',
          monthlyCost: 25,
          origin: 'online',
          answers: { form: 'juice', dose: 240 },
          chips: { form: 'Juice' },
          unknown: [],
          status: 'listed',
          position: 0,
        },
      ],
      updatedAt: new Date().toISOString(),
    });
    render(
      <ProgressProvider store={store}>
        <QuestionsFlow loadItems={loadItems} />
      </ProgressProvider>,
    );
    await screen.findByRole('heading', { name: /: which form\?$/ });
    fireEvent.click(screen.getByRole('radio', { name: 'Extract' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    });
    const box = await screen.findByLabelText(/: how much a day\?$/);
    expect((box as HTMLInputElement).value).toBe('');
    expect(screen.getByText('mg a day')).toBeTruthy();
    await waitFor(async () => expect((await store.load())?.items[0]?.answers.dose).toBeUndefined());
  });

  it('takes a per-serving dose and adds it up', async () => {
    const store = new LocalProgressStore(memory());
    await store.save({
      ...emptyProgress(),
      step: 'questions',
      seenQuestions: ['person:doctor', 'person:keep'],
      goals: [],
      items: [
        {
          id: 'o',
          itemKey: 'omega-3-fish-oil',
          monthlyCost: 20,
          origin: 'friend',
          answers: {},
          chips: {},
          unknown: [],
          status: 'listed',
          position: 0,
        },
      ],
      updatedAt: new Date().toISOString(),
    });
    render(
      <ProgressProvider store={store}>
        <QuestionsFlow loadItems={loadItems} />
      </ProgressProvider>,
    );
    const serving = await screen.findByLabelText(/mg of EPA \+ DHA per capsule/);
    fireEvent.change(serving, { target: { value: '300' } });
    fireEvent.change(screen.getByLabelText('capsules a day'), { target: { value: '2' } });
    expect(screen.getByText('600 mg of EPA + DHA a day')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    });
    await waitFor(async () => expect((await store.load())?.items[0]?.answers.dose).toBe(600));
  });

  it("asks about a doctor and what they would never give up, then skips that item's follow-ups", async () => {
    const store = new LocalProgressStore(memory());
    const stack = demoStack().filter((s) =>
      ['meditation-app-calm-headspace', 'magnesium-any-form', 'greens-powder-ag1-etc'].includes(
        s.itemKey ?? '',
      ),
    );
    await store.save({
      ...emptyProgress(),
      step: 'questions',
      goals: demoGoals,
      items: stack,
      updatedAt: new Date().toISOString(),
    });
    render(
      <ProgressProvider store={store}>
        <QuestionsFlow loadItems={loadItems} />
      </ProgressProvider>,
    );
    expect(
      await screen.findByRole('heading', { name: 'Did a doctor put you on any of these?' }),
    ).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Greens powder/ }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    });
    expect(
      await screen.findByRole('heading', { name: 'What would you never give up?' }),
    ).toBeTruthy();
    // The doctor's item is Protected now, so it is not offered here.
    expect(screen.queryByRole('button', { name: /Greens powder/ })).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Meditation app/ }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    });
    // Magnesium is the only item left with questions; the meditation app is theirs, so it gets none.
    expect(await screen.findByRole('heading', { name: /^Magnesium: / })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /^Meditation app/ })).toBeNull();
    await waitFor(async () => {
      const saved = await store.load();
      const greens = saved?.items.find((i) => i.itemKey === 'greens-powder-ag1-etc');
      const meditation = saved?.items.find((i) => i.itemKey === 'meditation-app-calm-headspace');
      expect(greens?.origin).toBe('doctor');
      expect(saved?.dayOne.yours).toEqual([meditation?.id]);
      expect(saved?.seenQuestions.slice(0, 2)).toEqual(['person:doctor', 'person:keep']);
    });
  });
});
