import { describe, expect, it } from 'vitest';
import { buildCatalogView } from '@distill/catalog';
import { checkLine, personFromProgress, scopeTrigger, type RitualPart, type RitualVersion } from '@distill/engine/ritual';
import { engineCatalog } from '../../catalog/engine';
import { catalog } from '../../catalog/server';
import { callJson, HAIKU, OPUS, type ClaudeClient } from './call';
import { classifyMessage } from './classify';
import { FALLBACK_REPLY, reshape } from './reshape';
import { fallbackLine, wordDecisions } from './word-decisions';
import { whyAnswer } from './reply';
import { z } from 'zod';

/** A stand-in for the SDK: records every request and answers from a script. */
function fakeClient(answers: unknown[]) {
  const requests: Record<string, unknown>[] = [];
  const reply = async (body: never) => {
    requests.push(body as Record<string, unknown>);
    const next = answers.shift();
    if (next instanceof Error) throw next;
    return {
      content: [{ type: 'text', text: typeof next === 'string' ? next : JSON.stringify(next) }],
      stop_reason: 'end_turn',
      model: (body as { model: string }).model,
      usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 4000, cache_creation_input_tokens: 0 },
    };
  };
  const client: ClaudeClient = { messages: { create: reply }, beta: { messages: { create: reply } } };
  return { client, requests };
}

const toneRules = catalog.toneRules;
const person = personFromProgress(
  {
    name: 'Ana',
    lifeText: 'Slow Saturday mornings, then a coffee walk with Sam and Leo.',
    goals: [],
    items: [],
    dayOne: { yours: [] },
    asks: [],
    picture: {
      lines: [
        { id: 'a', kind: 'people', text: 'Sam: coffee walks on Saturdays', by: 'distill', at: '' },
        { id: 'b', kind: 'people', text: 'Leo: coffee walks on Saturdays', by: 'distill', at: '' },
      ],
      removed: [],
    },
  },
  { personId: 'p1', timeZone: 'America/Los_Angeles', today: '2026-10-23' },
);

describe('calling Claude', () => {
  it('uses Opus with the refusal fallback and an hour-long cache, Haiku without either, and logs cost', async () => {
    const { client, requests } = fakeClient([{ ok: true }, { ok: true }]);
    const input = {
      step: 't',
      effort: 'low' as const,
      system: ['static one', 'static two'],
      content: '<message>hi</message>',
      jsonSchema: { type: 'object' },
      parse: z.object({ ok: z.boolean() }),
      timeoutMs: 5000,
    };
    const opus = await callJson(client, { ...input, model: OPUS });
    expect(opus.ok).toBe(true);
    expect(requests[0]).toMatchObject({ model: 'claude-opus-5-5', betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
    expect((requests[0]!.system as { cache_control?: unknown }[]).at(-1)!.cache_control).toEqual({ type: 'ephemeral', ttl: '1h' });
    expect((requests[0]!.system as { cache_control?: unknown }[])[0]!.cache_control).toBeUndefined();
    await callJson(client, { ...input, model: HAIKU });
    expect(requests[1]).toMatchObject({ model: 'claude-haiku-5-5', thinking: { type: 'disabled' } });
    expect(requests[1]).not.toHaveProperty('fallbacks');
    if (opus.ok) expect(opus.usage.costUsd).toBeCloseTo((1000 * 4 + 200 * 20 + 4000 * 0.2) / 1e6, 8);
  });
  it('retries once with the problems listed, then gives up', async () => {
    const { client, requests } = fakeClient(['not json', { n: 2 }]);
    const r = await callJson(client, {
      step: 't',
      model: OPUS,
      effort: 'low',
      system: ['s'],
      content: 'c',
      jsonSchema: {},
      parse: z.object({ n: z.number() }),
      check: (d) => (d.n > 1 ? ['n is too big'] : []),
      timeoutMs: 5000,
    });
    expect(r.ok).toBe(false);
    expect(requests).toHaveLength(2);
    expect(String((requests[1]!.messages as { content: string }[])[0]!.content)).toMatch(/could not be used/);
  });
  it('without a key, every step falls back and nothing breaks', async () => {
    expect((await callJson(null, { step: 't', model: OPUS, effort: 'low', system: [], content: '', jsonSchema: {}, parse: z.any(), timeoutMs: 1 })).ok).toBe(false);
  });
});

describe('reading a message', () => {
  it('never relies on the model alone to notice someone in danger', async () => {
    const { client } = fakeClient([{ intent: 'chat', trigger: null, season: null, safety: 'ok', condition: null, stack: null }]);
    const r = await classifyMessage(client, { text: "honestly I don't want to be alive some days", person, instant: '2026-10-23T18:40:00-07:00', today: '2026-10-23', minute: 1120, ritualTitles: [] });
    expect(r.ok && r.data.safety).toBe('crisis');
  });
});

describe('Example A, end to end through the reshape step', () => {
  const parts: RitualPart[] = [
    { id: 'p1', when: { slot: 'morning', days: ['sat'], at: '07:30' }, order: 0, title: 'Sunlight on the balcony', minutes: 10, area: 'mind', why: 'x', source: { kind: 'engine', rule: 'morning-light' }, status: 'active', lock: null },
    { id: 'p2', when: { slot: 'morning', days: ['sat'], at: '07:45' }, order: 1, title: 'Meditation', minutes: 15, area: 'mind', why: 'x', source: { kind: 'engine', rule: 'quiet-time' }, status: 'active', lock: null },
    { id: 'p3', when: { slot: 'morning', days: ['sat'], at: '10:00' }, order: 2, title: 'Coffee walk with Sam and Leo', minutes: 75, people: ['sam', 'leo'], area: 'move', why: 'x', source: { kind: 'words', quote: 'a coffee walk with Sam and Leo' }, status: 'active', lock: 'theirs' },
  ];
  const versions: RitualVersion[] = [
    { id: 'v1', personId: 'p1', version: 1, parentId: null, scope: { kind: 'base', effectiveFrom: '2026-10-01' }, parts, ops: [], changes: [], cause: { eventId: null, trigger: 'onboarding' }, status: 'accepted', engine: { engineVersion: 't', catalogVersion: 't', inputsHash: 't' }, createdAt: '' },
  ];
  const scope = scopeTrigger({ kind: 'message', dates: ['2026-10-23'], moments: ['night'], durability: 'once', load: 'lighter', today: '2026-10-23', versions, theirsItemIds: [], clinicianItemIds: [], protectedItemIds: [] });
  const input = {
    person,
    message: 'out late with the team tonight',
    trigger: { kind: 'message', durability: 'once' as const, load: 'lighter' as const, moments: ['night' as const] },
    scope,
    allowed: { words: person.identity.idealDay, stackItemIds: new Set<string>(), ideaIds: new Set<string>(), peopleIds: new Set(['sam', 'leo']), productNames: [] },
    toneRules,
    lineContext: { allowedNumbers: ['10', '10:00'], names: ['Sam', 'Leo', 'Ana'] },
    today: '2026-10-23',
  };
  const good = {
    reply: 'Have the best night with the team. Saturday starts slow, with a few quiet minutes in the sun before your coffee walk with Sam and Leo at 10.',
    ops: [
      { op: 'move', partId: 'p1', at: '09:15' },
      { op: 'shorten', partId: 'p2', minutes: 5 },
      { op: 'move', partId: 'p2', at: '09:25' },
    ],
    ongoing: false,
    ask: null,
  };
  it('applies a valid, lighter Saturday and keeps the coffee walk', async () => {
    const { client } = fakeClient([good]);
    const r = await reshape(client, input);
    expect(r.from).toBe('claude');
    expect(r.opsByDate['2026-10-24']).toHaveLength(3);
  });
  it('refuses to move the coffee walk, asks again, and falls back when it still does', async () => {
    const bad = { ...good, ops: [{ op: 'move', partId: 'p3', at: '11:00' }] };
    const { client, requests } = fakeClient([bad, bad]);
    const r = await reshape(client, input);
    expect(requests).toHaveLength(2);
    expect(r.from).toBe('fallback');
    expect(r.reply).toBe(FALLBACK_REPLY);
    expect(r.problems!.join()).toMatch(/theirs/);
  });
  it('refuses a reply that promises something the edits do not do', async () => {
    const promise = { ...good, reply: 'Lift tomorrow at 7 when you feel fresh.' };
    const { client } = fakeClient([promise, good]);
    const r = await reshape(client, input);
    expect(r.reply).toBe(good.reply);
  });
});

describe('wording decisions', () => {
  const draft = {
    key: 'ag1:clear',
    stackItemId: 'ag1',
    itemKey: 'greens-powder-ag1-etc',
    kind: 'clear' as const,
    reason: 'BORROWED_WEAK' as const,
    money: 99,
    name: 'AG1',
    context: {},
  };
  const ctx = { person, decisions: [draft], catalog: buildCatalogView(null, catalog), toneRules, lineContext: { allowedNumbers: ['99'], names: ['AG1'] }, today: '2026-10-23' };
  it('drops a line that breaks a rule and uses the plain fallback', async () => {
    const { client } = fakeClient([
      { lines: [{ id: 'ag1:clear', line: 'You should stop AG1, it is useless!' }] },
      { lines: [{ id: 'ag1:clear', line: 'You should stop AG1, it is useless!' }] },
    ]);
    const r = await wordDecisions(client, ctx);
    expect(r.decisions[0]!.lineFrom).toBe('fallback');
    expect(r.decisions[0]!.line).toBe(fallbackLine(draft));
  });
  it('every fallback line passes the same checks Claude has to pass', async () => {
    const reasons = [
      ['clear', 'BORROWED_WEAK'], ['clear', 'OVERLAP'], ['clear', 'UNUSED'], ['clear', 'DOSE_BELOW_MIN'], ['clear', 'FORM_NOT_ABSORBED'],
      ['clear', 'UNLOVED_HABIT'], ['clear', 'NOT_TRAINING'], ['clear', 'TOO_MANY_STEPS'], ['keep', 'THEIRS'], ['keep', 'LOVED'],
      ['keep', 'EVIDENCE_REGULAR'], ['keep', 'TRAINS'], ['keep', 'NOTHING_TO_CLEAR'], ['curate', 'ANCHOR'], ['curate', 'ADJUST_DOSE'],
      ['curate', 'ADJUST_FORM'], ['refer', 'SEE_A_DERMATOLOGIST'], ['refer', 'SEE_A_CLINICIAN'],
    ] as const;
    for (const [kind, reason] of reasons) {
      const line = fallbackLine({ ...draft, kind, reason, context: { keeperName: 'Melatonin' } });
      expect(checkLine(line, { toneRules, allowedNumbers: ['99'], names: ['AG1', 'Melatonin'], maxWords: 40 }), `${kind}:${reason}`).toEqual([]);
    }
  });
});

describe('a why, with Claude off', () => {
  const view = engineCatalog().item('alcohol-in-the-evening')!;
  const base = { view, name: 'Evening drinks', standing: 'clear' as const, offerSwap: true, fixed: true };
  it('answers in the catalog’s reviewed words, with a safety note only for a condition they told us about', () => {
    const plain = whyAnswer({ ...base, conditions: new Set() })!;
    expect(plain.startsWith(view.evidenceSummary)).toBe(true);
    const note = view.safety.find((s) => s.condition === 'diabetes')!.note;
    expect(plain).not.toContain(note);
    expect(whyAnswer({ ...base, conditions: new Set(['diabetes']) })).toContain(note);
  });
  it('offers the swap only when Distill suggested letting it go', () => {
    expect(whyAnswer({ ...base, conditions: new Set() })).toContain("One swap, if you'd like it: same plans");
    expect(whyAnswer({ ...base, offerSwap: false, conditions: new Set() })).not.toContain('swap');
  });
});
