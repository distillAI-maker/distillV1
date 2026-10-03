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

describe('Follow-ups', () => {
  afterEach(cleanup);
  beforeEach(() => {
    push.mockClear();
    document.documentElement.dataset.motion = 'reduce';
  });

  it('walks the demo person through twelve confirmations and lands on day one', async () => {
    const store = new LocalProgressStore(memory());
    await store.save({
      ...emptyProgress(),
      step: 'questions',
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
    expect(await screen.findByRole('heading', { name: 'Still paying for it?' })).toBeTruthy();
    expect(screen.getByText('Meditation app (Calm, Headspace)')).toBeTruthy();
    expect(screen.getByText(/Question 1 of/).textContent).toBe('Question 1 of 8');
    expect(screen.getByRole('radio', { name: 'Yes' }).getAttribute('aria-checked')).toBe('true');

    const headings: string[] = [];
    for (let i = 0; i < 12; i++) {
      const h = await screen.findByRole('heading', { level: 1 });
      headings.push(h.textContent ?? '');
      const cta = screen.queryByRole('button', { name: "That's right" }) ?? screen.getByRole('button', { name: 'Continue' });
      await act(async () => {
        fireEvent.click(cta);
      });
      if (push.mock.calls.length) break;
    }
    expect(headings).toEqual([
      'Still paying for it?',
      'When did you last use it?',
      'About how many days ago?',
      'Which form?',
      'How much a day?',
      'How much a day?',
      'Still paying for it?',
      'When did you last use it?',
      'What time, usually?',
      'How many nights a week, usually?',
      'We read this from your workouts.',
      'How long between dinner and bed, usually?',
    ]);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/day-one'));
    await waitFor(async () => {
      const saved = await store.load();
      expect(saved?.step).toBe('day-one');
      expect(saved?.seenQuestions).toHaveLength(12);
    });
  });

  it('asks a fresh item its questions and records "not sure" honestly', async () => {
    const store = new LocalProgressStore(memory());
    await store.save({
      ...emptyProgress(),
      step: 'questions',
      goals: ['sleep (general)'],
      items: [
        { id: 'a', itemKey: 'cbd', monthlyCost: 40, origin: 'online', answers: {}, chips: {}, unknown: [], status: 'listed', position: 0 },
      ],
      updatedAt: new Date().toISOString(),
    });
    render(
      <ProgressProvider store={store}>
        <QuestionsFlow loadItems={loadItems} />
      </ProgressProvider>,
    );
    expect(await screen.findByRole('heading', { name: 'Are you on any prescription medication?' })).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    });
    expect(screen.getByRole('alert').textContent).toBe('Pick one to go on.');
    fireEvent.click(screen.getByRole('radio', { name: 'Not sure' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/day-one'));
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
    await screen.findByRole('heading', { name: 'Which form?' });
    fireEvent.click(screen.getByRole('radio', { name: 'Extract' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    });
    const box = await screen.findByLabelText('How much a day?');
    expect((box as HTMLInputElement).value).toBe('');
    expect(screen.getByText('mg a day')).toBeTruthy();
    await waitFor(async () => expect((await store.load())?.items[0]?.answers.dose).toBeUndefined());
  });

  it('takes a per-serving dose and adds it up', async () => {
    const store = new LocalProgressStore(memory());
    await store.save({
      ...emptyProgress(),
      step: 'questions',
      goals: [],
      items: [
        { id: 'o', itemKey: 'omega-3-fish-oil', monthlyCost: 20, origin: 'friend', answers: {}, chips: {}, unknown: [], status: 'listed', position: 0 },
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
});
