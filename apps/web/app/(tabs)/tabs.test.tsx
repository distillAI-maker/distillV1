// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Decision, RitualPart, RitualVersion } from '@distill/engine/ritual';
import type { EngineResult, EngineState } from '../../lib/engine/client';
import { EngineProvider } from '../../lib/engine/context';
import { ProgressProvider } from '../../lib/progress/context';
import { emptyProgress, type Progress, type ProgressStore } from '../../lib/progress/types';
import { RitualTab } from './ritual/ritual-tab';
import { ThingsTab } from './things/things-tab';

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
vi.mock('../../lib/engine/client', () => ({ engineApi: api }));
vi.mock('../../lib/data/use-routed', () => ({
  useRouted: () => ({ routed: { items: [{ stackItemId: 'ag1', name: 'AG1' }, { stackItemId: 'pil', name: 'Pilates' }] }, summary: null, failed: false, retry: () => {} }),
}));
vi.mock('../../lib/ai/companion-client', () => ({ relearn: vi.fn(async () => null) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/ritual' }));
window.scrollTo = vi.fn() as never;

const stamp = { engineVersion: 't', catalogVersion: 't', inputsHash: 't' };
const part = (id: string, title: string, over: Partial<RitualPart> = {}): RitualPart => ({
  id,
  when: { slot: 'morning', days: [] },
  order: 0,
  title,
  area: 'mind',
  why: '',
  source: { kind: 'engine', rule: 'test' },
  status: 'active',
  lock: null,
  ...over,
});
const coffee = part('part:coffee', 'Balcony coffee', { when: { slot: 'morning', days: [], at: '07:30' } });
const pilates = part('part:pil', 'Pilates with Leah', {
  when: { slot: 'morning', days: ['sat'], at: '09:00' },
  lock: 'theirs',
  source: { kind: 'stack', stackItemId: 'pil', itemKey: null },
});
// Friday 30 October 2026 and the six days after it.
const dates = ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'];
const dayOf = (date: string, parts: RitualPart[], changed = false) => ({
  date,
  changed,
  parts: parts
    .filter((p) => !p.when.days.length || p.when.days.includes(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(`${date}T12:00:00Z`).getUTCDay()] as never))
    .map((p) => ({ ...p, moment: 'morning' as const })),
});
const decision: Decision = {
  id: '00000000-0000-4000-8000-000000000001',
  stackItemId: 'ag1',
  itemKey: 'greens',
  kind: 'clear',
  reason: 'BORROWED_WEAK',
  line: 'AG1 came from a feed, and nothing you have told me ties it to your mornings. It can go: $79 a month back.',
  money: 79,
  status: 'proposed',
  engine: stamp,
  createdAt: '2026-10-30T08:00:00.000Z',
};
function stateWith(over: Partial<EngineState> = {}, ritual: Partial<EngineState['ritual']> = {}): EngineState {
  const week = dates.map((d) => dayOf(d, [coffee, pilates]));
  return {
    person: { name: 'Maya', season: 'steady', nightsShapeMornings: false, wearable: null },
    ritual: { status: 'accepted', summary: '', proposed: null, today: week[0]!, week, lastChange: null, ...ritual },
    decisions: [decision],
    today: { kind: 'clear', decision },
    thread: [],
    items: { ag1: 'clear', pil: 'theirs' },
    money: { back: 0, waiting: 79 },
    ...over,
  };
}
const result = (state: EngineState, extra: Partial<EngineResult> = {}): EngineResult => ({ state, ...extra });
const item = (id: string, over: Partial<Progress['items'][number]> = {}): Progress['items'][number] => ({
  id,
  itemKey: null,
  customName: id,
  monthlyCost: id === 'ag1' ? 79 : 139,
  answers: {},
  chips: {},
  unknown: [],
  status: 'listed',
  notes: [],
  position: 0,
  ...over,
});

function signedIn(progress: Progress) {
  const saved: Progress[] = [];
  const store: ProgressStore = { id: 'supabase', load: async () => progress, save: async (p) => void saved.push(p), clear: async () => {} };
  return { store, saved };
}
const maya = (): Progress => ({ ...emptyProgress(), name: 'Maya', step: 'done', items: [item('ag1'), item('pil')] });

function renderTab(tab: 'ritual' | 'things', progress = maya()) {
  const { store, saved } = signedIn(progress);
  render(
    <ProgressProvider store={store}>
      <EngineProvider>{tab === 'ritual' ? <RitualTab /> : <ThingsTab />}</EngineProvider>
    </ProgressProvider>,
  );
  return saved;
}

describe('the Ritual tab', () => {
  afterEach(cleanup);
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
  });

  it('shows today as one line, ticks a part off, and keeps what is theirs locked', async () => {
    api.open.mockResolvedValue(result(stateWith()));
    api.run.mockResolvedValue(result(stateWith()));
    renderTab('ritual');
    expect(await screen.findByText('Balcony coffee')).toBeTruthy();
    expect(screen.getByText('7:30')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mark Balcony coffee done' }));
    await waitFor(() => expect(api.run).toHaveBeenCalledWith({ kind: 'part', partId: 'part:coffee', date: '2026-10-30', done: true }));
    // Saturday from the week strip: Pilates, locked.
    fireEvent.click(screen.getByRole('button', { name: 'Saturday' }));
    expect(screen.getByText('Pilates with Leah')).toBeTruthy();
    expect(screen.getByText('Yours. Distill never moves it.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mark Pilates with Leah done' })).toBeNull();
  });

  it('says the let-go firmly once, and Let it go takes it off their list', async () => {
    api.open.mockResolvedValue(result(stateWith()));
    api.run.mockResolvedValue(result(stateWith({ decisions: [{ ...decision, status: 'yes' }], today: { kind: 'clear', decision: { ...decision, status: 'yes' } } })));
    const saved = renderTab('ritual');
    expect(await screen.findByText(/It can go: \$79 a month back/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Not now' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'This is mine' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Let it go' }));
    await waitFor(() => expect(api.run).toHaveBeenCalledWith({ kind: 'decision-answer', decisionId: decision.id, answer: 'yes' }));
    expect(saved.at(-1)?.items.find((i) => i.id === 'ag1')?.status).toBe('cut');
    expect(await screen.findByText("That's all for today.")).toBeTruthy();
  });

  it('answers Why? in a sheet, about that thing', async () => {
    api.open.mockResolvedValue(result(stateWith()));
    api.message.mockResolvedValue(result(stateWith(), { reply: 'Greens powders mostly repeat what food already gives you.' }));
    renderTab('ritual');
    fireEvent.click(await screen.findByRole('button', { name: 'Why?' }));
    await waitFor(() => expect(api.message).toHaveBeenCalledWith('Why let AG1 go?', 'ag1'));
    const sheet = await screen.findByRole('dialog', { name: 'Why?' });
    expect(await within(sheet).findByText(/mostly repeat what food/)).toBeTruthy();
  });

  it("changes the day in place from What's coming up, marks it, and Undo puts it back", async () => {
    const before = stateWith();
    const sat = dates[1]!;
    const later = { ...coffee, when: { ...coffee.when, at: '08:15' } };
    const after = stateWith(
      {},
      {
        week: dates.map((d) => (d === sat ? dayOf(d, [later, pilates], true) : dayOf(d, [coffee, pilates]))),
        lastChange: { versionId: 'v-day', reply: 'Have fun tonight. Saturday starts gently.', scope: 'day', date: sat, undoable: true },
      },
    );
    api.open.mockResolvedValue(result(before));
    api.message.mockResolvedValue(result(after, { reply: 'Have fun tonight. Saturday starts gently.', versionId: 'v-day' }));
    api.undo.mockResolvedValue(result(before));
    renderTab('ritual');
    fireEvent.click(await screen.findByRole('button', { name: "What's coming up?" }));
    const sheet = screen.getByRole('dialog', { name: "What's coming up?" });
    fireEvent.change(within(sheet).getByRole('textbox'), { target: { value: 'drinks tonight, Pilates at 9 tomorrow' } });
    fireEvent.click(within(sheet).getByRole('button', { name: /Tell Distill/ }));
    await waitFor(() => expect(api.message).toHaveBeenCalledWith('drinks tonight, Pilates at 9 tomorrow'));
    expect(await screen.findByText('Have fun tonight. Saturday starts gently.')).toBeTruthy();
    expect(screen.getByText('You: drinks tonight, Pilates at 9 tomorrow')).toBeTruthy();
    expect(screen.getByText('Saturday, adjusted')).toBeTruthy();
    expect(screen.getByText('Later')).toBeTruthy();
    expect(screen.getByText('was 7:30')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(api.undo).toHaveBeenCalledWith('v-day'));
    await waitFor(() => expect(screen.queryByText('Saturday, adjusted')).toBeNull());
  });

  it('shows a lasting change as a proposed week, waiting for Make this my week', async () => {
    const proposed: RitualVersion = {
      id: '00000000-0000-4000-8000-0000000000aa',
      personId: 'p',
      version: 3,
      parentId: 'v1',
      scope: { kind: 'base', effectiveFrom: '2026-11-02' },
      parts: [coffee, pilates, part('part:run', 'Easy training run', { when: { slot: 'morning', days: ['mon', 'wed', 'fri'] } })],
      ops: [],
      changes: [{ op: 'add', partId: 'part:run', reason: 'Built around your training' }],
      cause: { eventId: null, trigger: 'plan' },
      status: 'proposed',
      reply: "Here's a week built around your training.",
      engine: stamp,
      createdAt: '2026-10-30T09:00:00.000Z',
    };
    api.open.mockResolvedValue(result(stateWith({}, { proposed })));
    api.accept.mockResolvedValue(result(stateWith()));
    renderTab('ritual');
    expect(await screen.findByText("Here's a week built around your training.")).toBeTruthy();
    expect(screen.getByText('Easy training run')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Make this my week/ }));
    await waitFor(() => expect(api.accept).toHaveBeenCalledWith(proposed.id));
  });
});

describe('Your things', () => {
  afterEach(cleanup);
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
  });

  it('shows their things, the let-go suggestion quietly, and a note gets Distill’s reply', async () => {
    const note = "Leah's moving to Oakland in the spring";
    const replied = stateWith({
      thread: [
        { id: 'm1', role: 'person', text: note, trigger: null, ritualVersionId: null, at: '2026-10-30T10:00:00.000Z' },
        { id: 'm2', role: 'companion', text: 'Then Saturdays stay yours either way.', trigger: null, ritualVersionId: null, at: '2026-10-30T10:00:01.000Z' },
      ],
    });
    api.open.mockResolvedValue(result(stateWith()));
    api.message.mockResolvedValue(result(replied, { reply: 'Then Saturdays stay yours either way.' }));
    const saved = renderTab('things');
    expect(await screen.findByText('Suggested to let go')).toBeTruthy();
    // Nothing let go yet, so no money back.
    expect(screen.queryByText('Money back')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Pilates/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Pilates' });
    expect(within(sheet).getByText('Yours. Distill never moves it.')).toBeTruthy();
    expect(within(sheet).queryByRole('button', { name: 'Let it go' })).toBeNull();
    fireEvent.change(within(sheet).getByPlaceholderText('Tell Distill about this'), { target: { value: note } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(api.message).toHaveBeenCalledWith(note, 'pil'));
    expect(saved.at(-1)?.items.find((i) => i.id === 'pil')?.notes.map((n) => n.text)).toEqual([note]);
    expect(await within(sheet).findByText('Then Saturdays stay yours either way.')).toBeTruthy();
  });

  it('shows money back only once something is let go', async () => {
    api.open.mockResolvedValue(result(stateWith({ money: { back: 79, waiting: 0 }, items: { ag1: 'clear', pil: 'theirs' } })));
    renderTab('things', { ...maya(), items: [item('ag1', { status: 'cut' }), item('pil')] });
    expect(await screen.findByText('Money back')).toBeTruthy();
    expect(screen.getByText('$79')).toBeTruthy();
    expect(await screen.findByText('Let go')).toBeTruthy();
  });
});
