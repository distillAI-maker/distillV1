// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RitualPart, RitualVersion } from '@distill/engine/ritual';
import type { EngineResult, EngineState } from '../../../lib/engine/client';
import { EngineProvider } from '../../../lib/engine/context';
import { ProgressProvider } from '../../../lib/progress/context';
import { emptyProgress, type Progress, type ProgressStore } from '../../../lib/progress/types';
import { CompanionScreen } from '../companion/companion-screen';
import { EngineToday } from '../home/engine-today';
import { RitualToday } from './ritual-today';

const api = vi.hoisted(() => ({
  state: vi.fn(),
  open: vi.fn(),
  run: vi.fn(),
  message: vi.fn(),
  accept: vi.fn(),
  undo: vi.fn(),
  settings: vi.fn(),
  explore: vi.fn(),
  exploreAnswer: vi.fn(),
  swapAnswer: vi.fn(),
}));
vi.mock('../../../lib/engine/client', () => ({ engineApi: api }));
vi.mock('../../../lib/data/use-routed', () => ({
  useRouted: () => ({ routed: { items: [{ stackItemId: 'ag1', name: 'AG1' }] }, summary: null, failed: false, retry: () => {} }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/today' }));

const stamp = { engineVersion: 't', catalogVersion: 't', inputsHash: 't' };
const part = (id: string, title: string, slot: RitualPart['when']['slot'], over: Partial<RitualPart> = {}): RitualPart => ({
  id,
  when: { slot, days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] },
  order: 0,
  title,
  area: 'mind',
  why: '',
  source: { kind: 'engine', rule: 'test' },
  status: 'active',
  lock: null,
  ...over,
});
const parts = [
  part('part:sun', 'Sunscreen', 'morning'),
  part('part:walk', 'Coffee walk with Sam', 'morning', { lock: 'theirs', when: { slot: 'morning', days: ['sat'], at: '10:00' } }),
  part('part:mel', 'Melatonin', 'night'),
];
// Wednesday 21 October 2026 and the six days after it.
const dates = ['2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'];
const day = (date: string) => {
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  const name = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dow] as RitualPart['when']['days'][number];
  const moment = (p: RitualPart) =>
    dow === 6 ? 'saturday' : dow === 0 ? 'sunday' : p.when.slot === 'morning' || p.when.slot === 'midday' ? 'morning' : 'night';
  return {
    date,
    changed: false,
    parts: parts.filter((p) => p.when.days.includes(name)).map((p) => ({ ...p, moment: moment(p) as never })),
  };
};
function stateWith(over: Partial<EngineState['ritual']> = {}, today: Partial<EngineState['today']> = { kind: null }): EngineState {
  return {
    person: { name: 'Ana', season: 'steady', nightsShapeMornings: false, wearable: null },
    ritual: {
      status: 'accepted',
      summary: '',
      proposed: null,
      today: day(dates[0]!),
      week: dates.map(day),
      lastChange: null,
      ...over,
    },
    decisions: [],
    today: { kind: null, ...today } as EngineState['today'],
    thread: [],
    items: {},
    money: { back: 0, waiting: 0 },
  };
}
const result = (state: EngineState, extra: Partial<EngineResult> = {}): EngineResult => ({ state, ...extra });

function signedIn(progress: Progress = { ...emptyProgress(), step: 'done' }) {
  const saved: Progress[] = [];
  const store: ProgressStore = {
    id: 'supabase',
    load: async () => progress,
    save: async (p) => void saved.push(p),
    clear: async () => {},
  };
  return { store, saved };
}

describe('today’s Ritual', () => {
  afterEach(cleanup);
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
  });

  it('shows the morning, checks a part off, and keeps what is theirs marked', async () => {
    const state = stateWith();
    api.open.mockResolvedValue(result(state));
    api.run.mockResolvedValue(result(state));
    const { store } = signedIn();
    render(
      <ProgressProvider store={store}>
        <EngineProvider>
          <RitualToday />
        </EngineProvider>
      </ProgressProvider>,
    );
    fireEvent.click(await screen.findByRole('tab', { name: 'Morning' }));
    expect(screen.getByText('Sunscreen')).toBeTruthy();
    expect(screen.queryByText('Melatonin')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Done' })[0]!);
    await waitFor(() => expect(api.run).toHaveBeenCalledWith({ kind: 'part', partId: 'part:sun', date: '2026-10-21', done: true }));
    fireEvent.click(screen.getByRole('tab', { name: 'Weekend' }));
    expect(screen.getByText('Coffee walk with Sam')).toBeTruthy();
    expect(screen.getByText('Yours')).toBeTruthy();
    // A day that hasn't come yet can't be checked off.
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
  });

  it('says what changed in Distill’s words, with Undo', async () => {
    const state = stateWith({
      lastChange: { versionId: 'v-day', reply: 'Have the best night with the team.', scope: 'day', date: '2026-10-24', undoable: true },
    });
    api.open.mockResolvedValue(result(state));
    api.undo.mockResolvedValue(result(stateWith()));
    const { store } = signedIn();
    render(
      <ProgressProvider store={store}>
        <EngineProvider>
          <RitualToday />
        </EngineProvider>
      </ProgressProvider>,
    );
    expect(await screen.findByText('Your Saturday, adjusted')).toBeTruthy();
    expect(screen.getByText('Have the best night with the team.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(api.undo).toHaveBeenCalledWith('v-day'));
    await waitFor(() => expect(screen.queryByText('Your Saturday, adjusted')).toBeNull());
  });

  it('shows a first Ritual as a draft until they say it is theirs', async () => {
    const proposed: RitualVersion = {
      id: 'v1',
      personId: 'p',
      version: 1,
      parentId: null,
      scope: { kind: 'base', effectiveFrom: '2026-10-21' },
      parts,
      ops: [],
      changes: [],
      cause: { eventId: null, trigger: 'onboarding' },
      status: 'proposed',
      engine: stamp,
      createdAt: '2026-10-21T19:00:00.000Z',
    };
    api.open.mockResolvedValue(result(stateWith({ status: 'proposed', proposed })));
    api.accept.mockResolvedValue(result(stateWith()));
    const { store } = signedIn();
    render(
      <ProgressProvider store={store}>
        <EngineProvider>
          <RitualToday />
        </EngineProvider>
      </ProgressProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'This is my Ritual' }));
    await waitFor(() => expect(api.accept).toHaveBeenCalledWith('v1'));
    expect(await screen.findByRole('tab', { name: 'Morning' })).toBeTruthy();
  });

  it('makes the first Ritual once onboarding is done, saving their list first', async () => {
    const none = stateWith({ status: 'none' });
    api.open.mockResolvedValue(result(none));
    api.run.mockResolvedValue(result(stateWith()));
    const { store, saved } = signedIn();
    render(
      <ProgressProvider store={store}>
        <EngineProvider>
          <RitualToday />
        </EngineProvider>
      </ProgressProvider>,
    );
    await waitFor(() => expect(api.run).toHaveBeenCalledWith({ kind: 'onboarding' }));
    expect(saved.length).toBeGreaterThan(0);
  });
});

describe('today’s one thing, from the engine', () => {
  afterEach(cleanup);
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
  });

  it('lets a clear go: the item leaves their list first, then the engine hears the yes', async () => {
    const progress: Progress = {
      ...emptyProgress(),
      step: 'done',
      items: [{ id: 'ag1', itemKey: 'greens-powder-ag1-etc', monthlyCost: 99, answers: {}, chips: {}, unknown: [], status: 'listed', notes: [], position: 0 }],
    };
    const decision = {
      id: '00000000-0000-4000-8000-000000000001',
      stackItemId: 'ag1',
      itemKey: 'greens-powder-ag1-etc',
      kind: 'clear' as const,
      reason: 'BORROWED_WEAK' as const,
      line: 'Greens powder came from someone else’s routine. Want to let it go and keep the $99 a month?',
      money: 99,
      status: 'proposed' as const,
      engine: stamp,
      createdAt: '2026-10-21T19:00:00.000Z',
    };
    const state = stateWith({}, { kind: 'clear', decision });
    api.open.mockResolvedValue(result(state));
    api.run.mockResolvedValue(result(stateWith({}, { kind: 'clear', decision: { ...decision, status: 'yes' } })));
    const { store, saved } = signedIn(progress);
    const routed = { items: [{ stackItemId: 'ag1', name: 'AG1' }] } as never;
    function Card() {
      return <EngineToday state={state} routed={routed} />;
    }
    render(
      <ProgressProvider store={store}>
        <EngineProvider>
          <Card />
        </EngineProvider>
      </ProgressProvider>,
    );
    expect(await screen.findByText('AG1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Let it go' }));
    await waitFor(() => expect(api.run).toHaveBeenCalledWith({ kind: 'decision-answer', decisionId: decision.id, answer: 'yes' }));
    expect(saved.at(-1)!.items[0]!.status).toBe('cut');
    // Why? opens the companion about this card.
    expect(screen.getByRole('link', { name: 'Why?' }).getAttribute('href')).toBe('/companion?about=ag1&why=clear');
  });
  it('offers the swap after a yes, and keeps “Added” on the card once it is in their Ritual', async () => {
    const progress: Progress = {
      ...emptyProgress(),
      step: 'done',
      items: [{ id: 'ag1', itemKey: 'greens-powder-ag1-etc', monthlyCost: 99, answers: {}, chips: {}, unknown: [], status: 'cut', notes: [], position: 0 }],
    };
    const decision = {
      id: '00000000-0000-4000-8000-000000000001',
      stackItemId: 'ag1',
      itemKey: 'greens-powder-ag1-etc',
      kind: 'clear' as const,
      reason: 'BORROWED_WEAK' as const,
      line: '',
      money: 99,
      status: 'yes' as const,
      engine: stamp,
      createdAt: '2026-10-21T19:00:00.000Z',
    };
    const swap = { itemKey: 'greens-powder-ag1-etc', stackItemId: 'ag1', title: 'Spinach and berry smoothie', slot: 'morning' as const, perWeek: 3 };
    const offered = stateWith({}, { kind: 'clear', decision, swap });
    const after = stateWith({}, { kind: 'clear', decision });
    api.open.mockResolvedValue(result(offered));
    api.swapAnswer.mockResolvedValue(result(after));
    const { store } = signedIn(progress);
    const routed = { items: [{ stackItemId: 'ag1', name: 'AG1' }] } as never;
    let current = offered;
    function Card() {
      return <EngineToday state={current} routed={routed} />;
    }
    const view = render(
      <ProgressProvider store={store}>
        <EngineProvider>
          <Card />
        </EngineProvider>
      </ProgressProvider>,
    );
    expect(await screen.findByText('Spinach and berry smoothie')).toBeTruthy();
    expect(screen.getByText(/3 times a week in the morning/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add to my Ritual' }));
    await waitFor(() => expect(api.swapAnswer).toHaveBeenCalledWith('greens-powder-ag1-etc', 'add'));
    current = after;
    view.rerender(
      <ProgressProvider store={store}>
        <EngineProvider>
          <Card />
        </EngineProvider>
      </ProgressProvider>,
    );
    expect(await screen.findByText('Added to your Ritual.')).toBeTruthy();
  });
  it('a Why? tap asks the companion about that card, once, and tidies the address', async () => {
    const progress: Progress = {
      ...emptyProgress(),
      step: 'done',
      items: [{ id: 'ag1', itemKey: 'greens-powder-ag1-etc', monthlyCost: 99, answers: {}, chips: {}, unknown: [], status: 'listed', notes: [], position: 0 }],
    };
    const swap = { itemKey: 'greens-powder-ag1-etc', stackItemId: 'ag1', title: 'Spinach and berry smoothie', slot: 'morning' as const, perWeek: 3 };
    api.open.mockResolvedValue(result(stateWith()));
    api.message.mockResolvedValue({ ...result(stateWith()), reply: 'No independent trial has tested a greens powder.', swap });
    window.history.replaceState(null, '', '/companion?about=ag1&why=clear');
    const { store } = signedIn(progress);
    render(
      <ProgressProvider store={store}>
        <EngineProvider>
          <CompanionScreen />
        </EngineProvider>
      </ProgressProvider>,
    );
    await waitFor(() => expect(api.message).toHaveBeenCalledWith('Why let AG1 go?', 'ag1'));
    expect(window.location.search).toBe('');
    expect(await screen.findByText('Spinach and berry smoothie · 3 times a week in the morning')).toBeTruthy();
    expect(api.message).toHaveBeenCalledTimes(1);
  });
});
