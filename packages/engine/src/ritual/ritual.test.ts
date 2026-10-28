import { describe, expect, it } from 'vitest';
import { composeByRules, whenFromWords } from './compose.js';
import { decide } from './decide.js';
import { resolveWhen } from './dates.js';
import { applyPersonOps, seasonOn } from './person.js';
import { applyOps, baseOn, plannedMinutes, ritualOn } from './ritual.js';
import { scopeTrigger } from './scope.js';
import { catalogView, personFor, progressWith, stackItem } from './test-support.js';
import { nightTrigger, slipTrigger } from './triggers.js';
import type { RitualPart, RitualVersion } from './types.js';
import { replyErrors, validateOps, validateRitual, type Allowed } from './validate.js';

const stamp = { engineVersion: 't', catalogVersion: 't', inputsHash: 't' };
const part = (over: Partial<RitualPart> & Pick<RitualPart, 'id' | 'title'>): RitualPart => ({
  when: { slot: 'morning', days: ['sat'] },
  order: 0,
  area: 'mind',
  why: 'Yours.',
  source: { kind: 'engine', rule: 'morning-light' },
  status: 'active',
  lock: null,
  ...over,
});
const base = (parts: RitualPart[], version = 1, effectiveFrom = '2026-10-01'): RitualVersion => ({
  id: `v${version}`,
  personId: 'p1',
  version,
  parentId: null,
  scope: { kind: 'base', effectiveFrom },
  parts,
  ops: [],
  changes: [],
  cause: { eventId: null, trigger: 'onboarding' },
  status: 'accepted',
  engine: stamp,
  createdAt: '2026-10-01T00:00:00Z',
});
const allowed = (over: Partial<Allowed> = {}): Allowed => ({
  words: 'Running along the Hudson while the day is still yours. out late with the team tonight',
  stackItemIds: new Set(['cr']),
  ideaIds: new Set(),
  peopleIds: new Set(['sam', 'leo']),
  productNames: ['creatine', 'greens powder', 'melatonin'],
  ...over,
});

// Example A from the build plan: Ana is out late on Friday 23 October.
const saturday = [
  part({ id: 'p1', title: 'Sunlight on the balcony', when: { slot: 'morning', days: ['sat'], at: '07:30' }, minutes: 10 }),
  part({ id: 'p2', title: 'Meditation', when: { slot: 'morning', days: ['sat'], at: '07:45' }, minutes: 15 }),
  part({
    id: 'p3',
    title: 'Coffee walk with Sam and Leo',
    when: { slot: 'morning', days: ['sat'], at: '10:00' },
    minutes: 75,
    people: ['sam', 'leo'],
    lock: 'theirs',
    source: { kind: 'words', quote: 'coffee walk with Sam and Leo' },
  }),
];

describe('Example A: out late with the team tonight', () => {
  const versions = [base(saturday)];
  it('scopes a late Friday to Saturday morning, with the coffee walk locked', () => {
    const scope = scopeTrigger({
      kind: 'message',
      dates: ['2026-10-23'],
      moments: ['night'],
      durability: 'once',
      load: 'lighter',
      today: '2026-10-23',
      versions,
      theirsItemIds: [],
      clinicianItemIds: [],
      protectedItemIds: [],
    });
    expect(scope.kind).toBe('day');
    expect(scope.targets.map((t) => [t.date, t.moments])).toEqual([['2026-10-24', ['saturday']]]);
    expect(scope.movable).toEqual(['p1', 'p2']);
    expect(scope.locked).toEqual(['p3']);
  });
  it('accepts a lighter, later start and keeps the coffee walk exactly as it was', () => {
    const ops = [
      { op: 'move' as const, partId: 'p1', at: '09:15' },
      { op: 'shorten' as const, partId: 'p2', minutes: 5 },
      { op: 'move' as const, partId: 'p2', at: '09:25' },
    ];
    const errors = validateOps({
      scope: 'day',
      before: ritualOn(versions, '2026-10-24').parts,
      ops,
      actor: 'engine',
      guarded: { locked: new Set(['p3']), protected: new Set() },
      allowed: allowed(),
      date: '2026-10-24',
      moments: ['saturday'],
      load: 'lighter',
    });
    expect(errors).toEqual([]);
    const day: RitualVersion = {
      ...base([], 2),
      id: 'd2',
      scope: { kind: 'day', date: '2026-10-24' },
      ops,
    };
    const view = ritualOn([...versions, day], '2026-10-24');
    expect(view.parts.map((p) => [p.title, p.when.at, p.minutes])).toEqual([
      ['Sunlight on the balcony', '09:15', 10],
      ['Meditation', '09:25', 5],
      ['Coffee walk with Sam and Leo', '10:00', 75],
    ]);
  });
  it('refuses to move, skip or swap the coffee walk, or to make the day fuller', () => {
    const check = (ops: Parameters<typeof validateOps>[0]['ops']) =>
      validateOps({
        scope: 'day',
        before: saturday,
        ops,
        actor: 'engine',
        guarded: { locked: new Set(['p3']), protected: new Set() },
        allowed: allowed(),
        date: '2026-10-24',
        moments: ['saturday'],
        load: 'lighter',
      });
    expect(check([{ op: 'move', partId: 'p3', at: '11:00' }]).join()).toMatch(/theirs/);
    expect(check([{ op: 'skip', partId: 'p3' }]).join()).toMatch(/theirs|people/);
    expect(
      check([
        {
          op: 'add',
          part: { title: 'Long run', slot: 'morning', minutes: 60, area: 'move', why: 'x', source: { kind: 'engine', rule: 'easy-movement' } },
        },
      ]).join(),
    ).toMatch(/fuller/);
    expect(
      check([
        {
          op: 'add',
          part: { title: 'Magnesium gummies', slot: 'night', area: 'sleep', why: 'x', source: { kind: 'engine', rule: 'wind-down-anchor' } },
        },
      ]).join(),
    ).toMatch(/to buy/);
  });
  it('never lets effort in under a rest label', () => {
    // Claude writes a long run and calls it quiet time: what lands is the quiet time code names.
    const ops = [
      {
        op: 'add' as const,
        part: { title: 'Long run', slot: 'morning' as const, at: '09:00', minutes: 90, area: 'move' as const, why: 'x', source: { kind: 'engine' as const, rule: 'quiet-time' } },
      },
    ];
    const day: RitualVersion = { ...base([], 2), id: 'd2', scope: { kind: 'day', date: '2026-10-24' }, ops };
    const view = ritualOn([base(saturday), day], '2026-10-24');
    expect(view.parts.find((p) => p.title === 'Long run')).toBeUndefined();
    expect(view.parts.filter((p) => p.source.kind === 'engine' && p.source.rule === 'quiet-time').map((p) => [p.title, p.area])).toEqual([['Quiet time', 'mind']]);
    // A rest label on anything code didn't name counts its time, so the lighter-day check sees it.
    const sleepIn = part({ id: 'r1', title: 'Sleep in', minutes: 90, source: { kind: 'engine', rule: 'slow-start' } });
    const labelled = part({ id: 'r2', title: 'Long run', minutes: 90, source: { kind: 'engine', rule: 'quiet-time' } });
    expect(plannedMinutes([...saturday, sleepIn])).toBe(plannedMinutes(saturday));
    expect(plannedMinutes([...saturday, labelled])).toBe(plannedMinutes(saturday) + 90);
  });
  it('the reply may only describe what was done', () => {
    const ctx = { times: ['09:15', '09:25', '10:00'], dates: ['2026-10-24'], message: 'out late with the team tonight', today: '2026-10-23' };
    expect(replyErrors('Saturday is set up for a slow start, then your coffee walk with Sam and Leo at 10.', ctx)).toEqual([]);
    expect(replyErrors('Lift tomorrow at 7 when you feel fresh.', ctx).length).toBeGreaterThan(0);
    expect(replyErrors('See you Monday.', ctx).join()).toMatch(/monday/);
  });
});

describe('Example B: a short night, and a well-founded part that stays', () => {
  const wednesday = [
    part({ id: 'm1', title: 'Strength session at Equinox', when: { slot: 'morning', days: ['wed'], at: '06:15' }, minutes: 60, area: 'move' }),
    part({
      id: 'm2',
      title: 'Creatine with breakfast',
      when: { slot: 'morning', days: ['wed'], at: '07:30' },
      area: 'eat',
      source: { kind: 'stack', stackItemId: 'cr', itemKey: 'creatine-monohydrate' },
      evidence: { itemKey: 'creatine-monohydrate', tier: 'A' },
    }),
  ];
  it('protects creatine from being skipped, and allows an easy run from their own words', () => {
    const guarded = { locked: new Set<string>(), protected: new Set(['m2']) };
    const base = { scope: 'day' as const, before: wednesday, actor: 'engine' as const, guarded, allowed: allowed(), date: '2026-10-28', moments: ['morning' as const], load: 'lighter' as const };
    expect(validateOps({ ...base, ops: [{ op: 'skip', partId: 'm2' }] }).join()).toMatch(/well-founded/);
    expect(
      validateOps({
        ...base,
        ops: [
          {
            op: 'swap',
            partId: 'm1',
            with: {
              title: 'Easy run along the Hudson',
              slot: 'morning',
              at: '06:45',
              minutes: 30,
              area: 'move',
              why: 'The run you love, at an easy pace.',
              source: { kind: 'words', quote: 'Running along the Hudson while the day is still yours' },
            },
          },
        ],
      }),
    ).toEqual([]);
  });
  it('fires only when they turned it on, only on a night well below their own usual, and not twice in three days', () => {
    const person = personFor(progressWith([]));
    const nights = Array.from({ length: 28 }, (_, i) => ({
      date: `2026-10-${String(i).padStart(2, '0')}`.replace('-00', '-30').replace('2026-10-30', '2026-09-30'),
      sleepMin: 420 + (i % 5) * 6,
    }));
    const withHistory = { ...person, signals: { ...person.signals, lastNights: [...nights.slice(0, 27), { date: '2026-10-27', sleepMin: 305 }] } };
    expect(nightTrigger(withHistory, { today: '2026-10-28' }).why).toBe('off');
    const on = { ...withHistory, prefs: { nightsShapeMornings: true } };
    expect(nightTrigger(on, { today: '2026-10-28' }).fire).toBe(true);
    expect(nightTrigger(on, { today: '2026-10-28', lastNightReshape: '2026-10-26' }).why).toBe('too-soon');
    const usual = { ...on, signals: { ...on.signals, lastNights: [...nights.slice(0, 27), { date: '2026-10-27', sleepMin: 415 }] } };
    expect(nightTrigger(usual, { today: '2026-10-28' }).fire).toBe(false);
  });
});

describe('Example C: an ongoing plan is a new base week, starting when they said', () => {
  const sunday = part({ id: 's1', title: 'Farmers market', when: { slot: 'morning', days: ['sun'], at: '09:00' }, minutes: 90 });
  const bath = part({ id: 'n1', title: 'Bath and a book', when: { slot: 'night', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] }, lock: 'theirs' });
  it('scopes "training starts Monday" to the base week from that Monday', () => {
    const scope = scopeTrigger({
      kind: 'plan',
      dates: ['2026-11-02'],
      moments: ['sunday', 'night', 'morning'],
      durability: 'ongoing',
      load: 'heavier',
      today: '2026-10-24',
      versions: [base([sunday, bath])],
      theirsItemIds: [],
      clinicianItemIds: [],
      protectedItemIds: [],
    });
    expect(scope.kind).toBe('base');
    expect(scope.effectiveFrom).toBe('2026-11-02');
    expect(scope.locked).toEqual(['n1']);
  });
  it('a later base change still reaches a day that was adjusted earlier, and drops edits that no longer apply', () => {
    const v1 = base([sunday, bath]);
    const day: RitualVersion = { ...base([], 2), id: 'd', scope: { kind: 'day', date: '2026-11-08' }, ops: [{ op: 'move', partId: 's1', at: '10:30' }] };
    const added = applyOps(v1.parts, [
      { op: 'add', part: { title: 'Long run with your sister', slot: 'morning', days: ['sun'], at: '07:30', minutes: 60, area: 'move', why: 'x', source: { kind: 'words', quote: 'SF Marathon in July with my sister' } } },
    ], { scope: 'base', newId: () => 'r1' }).parts;
    const v3 = { ...base(added, 3, '2026-11-02'), id: 'v3' };
    const view = ritualOn([v1, day, v3], '2026-11-08');
    expect(view.parts.map((p) => p.title)).toEqual(['Long run with your sister', 'Farmers market', 'Bath and a book']);
    expect(view.parts.find((p) => p.id === 's1')!.when.at).toBe('10:30');
    // Before the plan starts, the old week is in force.
    expect(baseOn([v1, v3], '2026-11-01')!.id).toBe('v1');
    const removed = applyOps(added, [{ op: 'remove', partId: 's1' }], { scope: 'base', newId: () => 'x' }).parts;
    const v4 = { ...base(removed, 4, '2026-11-02'), id: 'v4' };
    expect(ritualOn([v1, day, v4], '2026-11-08').stale).toEqual([{ op: 'move', partId: 's1', at: '10:30' }]);
  });
});

describe('dates are resolved by code', () => {
  it('reads tonight after midnight as the night under way', () => {
    expect(resolveWhen({ phrase: 'tonight', start: { kind: 'tonight' } }, [], { today: '2026-10-24', minute: 30 })!.dates).toEqual(['2026-10-23']);
    expect(resolveWhen({ phrase: 'tonight', start: { kind: 'tonight' } }, [], { today: '2026-10-23', minute: 18 * 60 + 40 })!.dates).toEqual(['2026-10-23']);
  });
  it('reads Thursday to Sunday, next weekend, and a calendar date', () => {
    const today = { today: '2026-10-20', minute: 600 }; // a Tuesday
    expect(
      resolveWhen({ phrase: 'Thursday to Sunday', start: { kind: 'weekday', day: 'thu', which: 'this' }, end: { kind: 'weekday', day: 'sun', which: 'this' } }, [], today)!.dates,
    ).toEqual(['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
    expect(resolveWhen({ phrase: 'next weekend', start: { kind: 'weekend', which: 'next' } }, [], today)!.dates).toEqual(['2026-10-31', '2026-11-01']);
    expect(resolveWhen({ phrase: 'Nov 2', start: { kind: 'date', month: 11, day: 2 } }, [], today)!.dates).toEqual(['2026-11-02']);
  });
  it('code wins over the model, and far-off model dates are refused', () => {
    const r = resolveWhen({ phrase: 'tomorrow', start: { kind: 'tomorrow' } }, ['2026-10-25'], { today: '2026-10-20', minute: 600 })!;
    expect(r.dates).toEqual(['2026-10-21']);
    expect(r.disagreed).toBe(true);
    expect(resolveWhen(null, ['2027-06-01'], { today: '2026-10-20', minute: 600 })).toBeNull();
  });
});

describe('composing by rules', () => {
  it('places what they keep, leaves out what is being cleared, and keeps day one small', () => {
    const items = [
      stackItem('cr', 'creatine-monohydrate'),
      stackItem('sun', 'sunscreen-daily-spf-30'),
      stackItem('ret', 'retinol-retinoid-nightly'),
      stackItem('ag1', 'greens-powder-ag1-etc', { origin: 'online' }),
      stackItem('wine', null, {
        customName: 'Wine Fridays',
        status: 'kept',
        notes: [{ id: 'n', text: 'Fridays Sam and I open a bottle and cook something ambitious.', at: '2026-10-21' }],
      }),
    ];
    const progress = progressWith(items, {
      picture: { lines: [{ id: 'l', kind: 'people', text: 'Sam: cooks with you on Fridays', by: 'distill', at: '' }], removed: [] },
    });
    const person = personFor(progress);
    const decided = decide({ person, stack: items, catalog: catalogView, history: [], today: '2026-10-21' });
    const { parts } = composeByRules({ person, stack: items, decided, catalog: catalogView, firstCompose: true });
    const byTitle = Object.fromEntries(parts.map((p) => [p.title, p]));
    expect(Object.keys(byTitle).sort()).toEqual(['Creatine', 'Retinoid', 'Sunscreen', 'Wine Fridays']);
    expect(byTitle.Creatine!.when.slot).toBe('morning');
    expect(byTitle.Retinoid!.when.slot).toBe('night');
    expect(byTitle['Wine Fridays']!.when.days).toEqual(['fri']);
    expect(byTitle['Wine Fridays']!.lock).toBe('theirs');
    expect(byTitle['Wine Fridays']!.people).toEqual(['sam']);
    expect(validateRitual({ parts, allowed: allowed({ stackItemIds: new Set(items.map((i) => i.id)) }), perMoment: 3 })).toEqual([]);
  });
  it('never plans a habit that costs them into their days, unless their words make it theirs', () => {
    const items = [
      stackItem('a', 'creatine-monohydrate'),
      stackItem('nic', 'nicotine-pouches-vape'),
      stackItem('wine', 'alcohol-in-the-evening', { notes: [{ id: 'n', text: 'Wine night with friends on Fridays.', at: '2026-10-21' }] }),
    ];
    const person = personFor(progressWith(items));
    const decided = decide({ person, stack: items, catalog: catalogView, history: [], today: '2026-10-21' });
    // Not now: the swap rests, and still no part and no "stays" card.
    const rested = decide({
      person,
      stack: items,
      catalog: catalogView,
      history: [{ stackItemId: 'nic', kind: 'clear', reason: 'UNLOVED_HABIT', status: 'not-now', answeredAt: '2026-10-20T10:00:00Z' }],
      today: '2026-10-21',
    });
    expect(rested.decisions.filter((d) => d.stackItemId === 'nic')).toEqual([]);
    for (const d of [decided, rested]) {
      const titles = composeByRules({ person, stack: items, decided: d, catalog: catalogView, firstCompose: true }).parts.map((p) => p.title);
      expect(titles).not.toContain('Nicotine');
      expect(titles).toContain('Evening drinks');
    }
  });
  it('shows a doctor’s thing locked, lets pills ride along, and leaves when-needed things off the schedule', () => {
    const items = [
      stackItem('cpap', null, { customName: 'CPAP', origin: 'doctor', notes: [{ id: 'n', text: 'Sleep study last year. Makes me a different guy.', at: '2026-10-21' }] }),
      stackItem('mel', 'melatonin', { notes: [{ id: 'n', text: 'Only on travel nights.', at: '2026-10-21' }] }),
      stackItem('cr', 'creatine-monohydrate', { answers: { trains: true, usesLast30Days: 30, dose: 5, doseUnit: 'g' } }),
      stackItem('sun', 'sunscreen-daily-spf-30', { answers: { usesLast30Days: 30 } }),
      stackItem('fish', null, { customName: 'Saturday fishing with Eddie', status: 'kept', notes: [{ id: 'n', text: 'Saturdays we fish at Breezy Point.', at: '2026-10-21' }] }),
    ];
    const person = personFor(progressWith(items));
    const decided = decide({ person, stack: items, catalog: catalogView, history: [], today: '2026-10-21' });
    const parts = composeByRules({ person, stack: items, decided, catalog: catalogView, firstCompose: true }).parts;
    const byTitle = Object.fromEntries(parts.map((p) => [p.title, p]));
    expect(byTitle.CPAP).toMatchObject({ lock: 'clinician', when: { slot: 'night' } });
    expect(byTitle.Melatonin).toBeUndefined();
    expect(byTitle['Saturday fishing with Eddie']!.place).toBe('Breezy Point');
    expect(Object.values(byTitle).every((p) => !/Part of your days as they are/.test(p.why))).toBe(true);
  });
  it('puts an anchored thing there every day, next to its anchor', () => {
    const items = [stackItem('cr', 'creatine-monohydrate', { answers: { trains: true, usesLast30Days: 10, dose: 5, doseUnit: 'g', paired: true } })];
    const person = personFor(progressWith(items));
    const decided = decide({ person, stack: items, catalog: catalogView, history: [], today: '2026-10-21' });
    const part = composeByRules({ person, stack: items, decided, catalog: catalogView, firstCompose: true }).parts.find((p) => p.title === 'Creatine')!;
    expect(part.when).toEqual({ slot: 'morning', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] });
    expect(part.why).toBe('Next to your morning coffee or breakfast, so it happens without thinking.');
  });
  it('a full weekend never pushes a daily thing out of the weekdays', () => {
    const items = [
      stackItem('a', 'creatine-monohydrate'),
      stackItem('b', 'sunscreen-daily-spf-30'),
      stackItem('c', 'melatonin'),
      stackItem('d', 'retinol-retinoid-nightly'),
    ];
    const progress = progressWith(items);
    const person = personFor(progress);
    const decided = decide({ person, stack: items, catalog: catalogView, history: [], today: '2026-10-21' });
    const { parts } = composeByRules({ person, stack: items, decided, catalog: catalogView, firstCompose: true });
    // Pills and creams ride along with their moment, so none of them crowds out another day.
    expect(parts).toHaveLength(4);
    expect(parts.filter((p) => p.when.days.length === 7)).toHaveLength(4);
    // Three things they do a moment on day one; what rides along fills up to the most a moment holds.
    expect(validateRitual({ parts, allowed: allowed({ stackItemIds: new Set(items.map((i) => i.id)) }), perMoment: 6 })).toEqual([]);
  });
  it('reads days and times from their words, and never reads "the sun" as Sunday', () => {
    expect(whenFromWords('Saturday 9am with Leah')).toEqual({ days: ['sat'], at: '09:00', slot: 'morning' });
    expect(whenFromWords('sit in the sun with coffee').days).toBeUndefined();
    expect(whenFromWords('every night before bed').slot).toBe('night');
  });
});

describe('the person model learns only from their own words', () => {
  const person = () => {
    const p = personFor(progressWith([stackItem('ag1', 'greens-powder-ag1-etc'), stackItem('pil', 'yoga-pilates-studio')]));
    p.values.pil = { attachment: 'loved', reasons: ['best part of my week'], from: 'note' };
    return p;
  };
  const ctx = { today: '2026-10-21', at: '2026-10-21T10:00:00Z', from: 'note' as const };
  it('drops anything that does not quote them', () => {
    const r = applyPersonOps(person(), [{ op: 'person', name: 'Leah', what: 'Pilates friend', quote: 'my friend Leah' }], 'Saturday 9am with Leah.', ctx);
    expect(r.applied).toEqual([]);
    expect(r.dropped[0]!.why).toMatch(/quote/);
  });
  it('needs their explicit words for "borrowed", and turns a downgrade of something loved into a question', () => {
    const text = 'Started AG1 because of a TikTok, honestly feel nothing. Pilates is fine I guess.';
    const r = applyPersonOps(
      person(),
      [
        { op: 'attachment', stackItemId: 'ag1', attachment: 'borrowed', basis: 'implied', quote: 'Started AG1 because of a TikTok' },
        { op: 'attachment', stackItemId: 'pil', attachment: 'neutral', basis: 'explicit', quote: 'Pilates is fine I guess' },
      ],
      text,
      ctx,
    );
    expect(r.applied).toEqual([]);
    expect(r.ask).toEqual([{ stackItemId: 'pil', attachment: 'neutral', quote: 'Pilates is fine I guess' }]);
    const explicit = applyPersonOps(
      person(),
      [{ op: 'attachment', stackItemId: 'ag1', attachment: 'borrowed', basis: 'explicit', quote: 'because of a TikTok, honestly feel nothing' }],
      text,
      ctx,
    );
    expect(explicit.person.values.ag1!.attachment).toBe('borrowed');
  });
  it('a season wears off on its own', () => {
    const r = applyPersonOps(person(), [{ op: 'season', season: 'busy', quote: 'rough week at work' }], 'rough week at work', ctx);
    expect(seasonOn(r.person, '2026-10-25')).toBe('busy');
    expect(seasonOn(r.person, '2026-10-30')).toBe('steady');
  });
});

describe('a slip is only ever explicit skips', () => {
  const morning = [part({ id: 'a', title: 'Coffee, window, no phone', when: { slot: 'morning', days: ['mon', 'tue', 'wed', 'thu', 'fri'] } })];
  it('does not read silence as a slip', () => {
    expect(slipTrigger(() => morning, [], { today: '2026-10-23' })).toEqual([]);
  });
  it('fires after three explicit skips in the last four recorded days', () => {
    const checks = ['2026-10-22', '2026-10-21', '2026-10-20', '2026-10-19'].map((date, i) => ({ partId: 'a', date, done: i === 3 }));
    expect(slipTrigger(() => morning, checks, { today: '2026-10-23' })).toEqual([
      { moment: 'morning', dates: ['2026-10-22', '2026-10-21', '2026-10-20'] },
    ]);
  });
});
