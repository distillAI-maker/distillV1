// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import type { RitualPart } from '@distill/engine/ritual';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyProgress } from '../../../lib/progress/types';
import { Reveal } from './reveal';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));
vi.mock('../../../components/onboarding/go', () => ({ useGo: () => vi.fn() }));
vi.mock('../../../components/back-trail', () => ({ useGoBack: () => vi.fn() }));
vi.mock('../../../lib/progress/context', () => ({
  useProgress: () => ({ ready: true, progress: { ...emptyProgress(), name: 'Derek' } }),
}));

const part = (title: string, why: string): RitualPart => ({
  id: `part:${title}`,
  when: { slot: 'morning', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] },
  order: 0,
  title,
  area: 'mind',
  why,
  source: { kind: 'engine', rule: 'test' },
  status: 'active',
  lock: null,
});
const rules = [part('Rules version', 'From the rules.')];
const claude = [part('Claude version', 'In their words.')];

const notes = { letGo: [], wellFounded: [], worthALook: [] };
const reveal = vi.fn();
const shape = vi.fn();
vi.mock('../../../lib/engine/preview', () => ({ revealRitual: () => reveal() }));
vi.mock('../../../lib/engine/first-ritual', () => ({ shapeFirstRitual: () => shape(), keepFirstRitual: vi.fn() }));

/** Lets time pass and every promise settle. */
const pass = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

describe('their first Ritual', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('scrollTo', vi.fn());
    delete document.documentElement.dataset.motion;
    reveal.mockReset();
    shape.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows nothing thin first: it holds on the shaping screen, then the whole page at once', async () => {
    let answer!: (v: { parts: RitualPart[] }) => void;
    reveal.mockResolvedValue({ parts: rules, notes, shaping: true });
    shape.mockReturnValue(new Promise((done) => (answer = done)));
    render(<Reveal />);
    await pass(10_000);
    expect(screen.queryByText('Rules version')).toBeNull();
    expect(screen.getByText(/./, { selector: '.rv-shaping span' })).toBeTruthy();

    await act(async () => answer({ parts: claude }));
    await pass(0);
    expect(screen.getByText('Claude version')).toBeTruthy();
    expect(screen.getByText('In their words.')).toBeTruthy();
    expect(screen.queryByText('Rules version')).toBeNull();
  });

  it("falls back to the detailed rules version when Claude is slow, and never changes under them", async () => {
    let answer!: (v: { parts: RitualPart[] }) => void;
    reveal.mockResolvedValue({ parts: rules, notes, shaping: true });
    shape.mockReturnValue(new Promise((done) => (answer = done)));
    render(<Reveal />);
    await pass(30_000);
    expect(screen.getByText('Rules version')).toBeTruthy();

    await act(async () => answer({ parts: claude }));
    await pass(1000);
    expect(screen.getByText('Rules version')).toBeTruthy();
    expect(screen.queryByText('Claude version')).toBeNull();
  });

  it('does not wait at all with Claude off, or when Claude has nothing', async () => {
    reveal.mockResolvedValue({ parts: rules, notes, shaping: false });
    render(<Reveal />);
    await pass(1200);
    expect(screen.getByText('Rules version')).toBeTruthy();
    expect(shape).not.toHaveBeenCalled();
    cleanup();

    reveal.mockResolvedValue({ parts: rules, notes, shaping: true });
    shape.mockResolvedValue(null);
    render(<Reveal />);
    await pass(1200);
    expect(screen.getByText('Rules version')).toBeTruthy();
  });

  it('says so when even the rules fail', async () => {
    reveal.mockRejectedValue(new Error('down'));
    render(<Reveal />);
    await pass(1200);
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
