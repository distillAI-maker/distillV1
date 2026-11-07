// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RitualPart } from '@distill/engine/ritual';
import { emptyProgress, progressSchema, type Progress } from '../progress/types';

const item = { itemKey: 'creatine-monohydrate', id: 'a', monthlyCost: 14, position: 0, status: 'listed' as const, answers: {}, chips: {}, unknown: [], notes: [] };
const person = (extra: Partial<Progress> = {}): Progress => ({ ...emptyProgress(), name: 'Maya', items: [item], ...extra });
const parts = [{ id: 'part:a', title: 'Creatine' }] as unknown as RitualPart[];

describe('their first Ritual, once it starts being shaped', () => {
  const fetcher = vi.fn();
  /** The module holds the request it's waiting on, so each test starts with a fresh one. */
  const load = async () => {
    vi.resetModules();
    return import('./first-ritual');
  };
  beforeEach(() => {
    fetcher.mockReset();
    fetcher.mockImplementation(async () => new Response(JSON.stringify({ parts })));
    vi.stubGlobal('fetch', fetcher);
    sessionStorage.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('asks once for the same answers, wherever they have got to in onboarding', async () => {
    const { shapeFirstRitual } = await load();
    const first = shapeFirstRitual(person({ step: 'study' }), 'UTC');
    const later = shapeFirstRitual(person({ step: 'reveal', member: true, joinedEmail: 'm@x.co', updatedAt: '2026-11-05T00:00:00.000Z' }), 'UTC');
    expect(await first).toEqual({ parts });
    expect(await later).toEqual({ parts });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('asks again when an answer changes, or when the last ask came back with nothing', async () => {
    const { shapeFirstRitual } = await load();
    await shapeFirstRitual(person(), 'UTC');
    await shapeFirstRitual(person({ name: 'Mia' }), 'UTC');
    expect(fetcher).toHaveBeenCalledTimes(2);

    fetcher.mockImplementation(async () => new Response(JSON.stringify({ parts: null })));
    expect(await shapeFirstRitual(person({ name: 'Ana' }), 'UTC')).toBeNull();
    await shapeFirstRitual(person({ name: 'Ana' }), 'UTC');
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('settles on nothing when the network fails, so the page can show the rules version', async () => {
    const { shapeFirstRitual } = await load();
    fetcher.mockRejectedValue(new Error('offline'));
    await expect(shapeFirstRitual(person(), 'UTC')).resolves.toBeNull();
  });

  it('keeps the Ritual they accepted in their progress, so it reaches the account, until their list changes', async () => {
    const { keepFirstRitual, keptFirstRitual } = await load();
    const firstRitual = keepFirstRitual(person({ step: 'reveal' }), parts);
    // Saved progress reads back in the schema's key order, wherever it went.
    const reloaded = progressSchema.parse(JSON.parse(JSON.stringify(person({ step: 'done', member: true, firstRitual }))));
    expect(keptFirstRitual(reloaded)).toEqual(parts);
    // A note or a new city doesn't make it a different Ritual; a change to the list does.
    expect(keptFirstRitual({ ...reloaded, region: 'Oakland', items: reloaded.items.map((i) => ({ ...i, notes: [{ id: 'n', text: 'hi', at: 'x' }] })) })).toEqual(parts);
    expect(keptFirstRitual({ ...reloaded, items: [] })).toBeNull();
    expect(keptFirstRitual({ ...reloaded, items: reloaded.items.map((i) => ({ ...i, status: 'cut' as const })) })).toBeNull();
    expect(keptFirstRitual(person())).toBeNull();
  });
});
