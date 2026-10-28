import { describe, expect, it } from 'vitest';
import { decide, type DecideInput } from './decide.js';
import { NOT_SURE, valuableQuestions, withPatch } from './questions.js';
import { catalogView, personFor, progressWith, stackItem } from './test-support.js';
import type { PersonModel, PriorDecision } from './types.js';
import type { StackItemLike } from './usage.js';

function run(items: StackItemLike[], tweak: (p: PersonModel) => void = () => {}, history: PriorDecision[] = []) {
  const progress = progressWith(items);
  const person = personFor(progress);
  tweak(person);
  const input: DecideInput = { person, stack: items, catalog: catalogView, history, today: '2026-10-21' };
  return { input, result: decide(input) };
}
const of = (r: ReturnType<typeof decide>, id: string) =>
  r.decisions.filter((d) => d.stackItemId === id).map((d) => `${d.kind}:${d.reason}`).sort();

describe('decide: what is outside the edit', () => {
  it('never decides anything from a clinician, and never touches the wearable subscription', () => {
    const { result } = run([
      stackItem('vitd', 'vitamin-d3', { origin: 'blood test' }),
      stackItem('therapy', 'therapy-counselling'),
      stackItem('oura', null, { customName: 'Oura membership', dataSource: true, monthlyCost: 6 }),
    ]);
    expect(of(result, 'vitd')).toEqual([]);
    expect(of(result, 'therapy')).toEqual([]);
    expect(of(result, 'oura')).toEqual([]);
    expect(result.clinicianIds).toEqual(['therapy', 'vitd']);
  });
  it('sends a skin active to a dermatologist once a skin condition is in their own words', () => {
    const { result } = run([stackItem('ret', 'retinol-retinoid-nightly')], (p) => {
      p.constraints.conditions.push({ condition: 'skin-condition', quote: 'my eczema flares', at: '2026-10-21' });
    });
    expect(of(result, 'ret')).toEqual(['refer:SEE_A_DERMATOLOGIST']);
  });
  it('leaves a retinoid to their clinician during pregnancy', () => {
    const { result } = run([stackItem('ret', 'retinol-retinoid-nightly')], (p) => {
      p.constraints.conditions.push({ condition: 'pregnant', quote: "I'm pregnant", at: '2026-10-21' });
    });
    expect(of(result, 'ret')).toEqual([]);
    expect(result.clinicianIds).toContain('ret');
  });
});

describe('decide: values come first', () => {
  it('keeps what they marked theirs, whatever the evidence', () => {
    const { result } = run([stackItem('ag1', 'greens-powder-ag1-etc', { origin: 'online', status: 'kept' })]);
    expect(of(result, 'ag1')).toEqual(['keep:THEIRS']);
    expect(result.theirsIds).toEqual(['ag1']);
  });
  it('keeps what their words show they love', () => {
    const { result } = run([stackItem('ag1', 'greens-powder-ag1-etc', { origin: 'online' })], (p) => {
      p.values.ag1 = { attachment: 'loved', reasons: ['my morning thing with my sister'], from: 'note' };
    });
    expect(of(result, 'ag1')).toEqual(['keep:LOVED']);
  });
});

describe('decide: evidence protects, and a bad dose is fixed, never cleared', () => {
  const gym = stackItem('gym', 'gym-membership', { answers: { visitsLast30Days: 10 } });
  it('protects creatine for someone who trains, even unfelt', () => {
    const { result } = run([stackItem('cr', 'creatine-monohydrate', { origin: 'podcast' }), gym]);
    expect(of(result, 'cr')).toEqual(['keep:TRAINS']);
    expect(result.protectedIds).toContain('cr');
  });
  it('doubt protects: creatine is kept when we do not know whether they train', () => {
    const { result } = run([stackItem('cr', 'creatine-monohydrate')]);
    expect(of(result, 'cr')).toEqual(['keep:EVIDENCE_REGULAR']);
  });
  it('a dose below what was studied becomes an adjustment, not a clear', () => {
    const { result } = run([
      stackItem('cr', 'creatine-monohydrate', { answers: { dose: 2, doseUnit: 'g' } }),
      gym,
    ]);
    expect(of(result, 'cr')).toEqual(['curate:ADJUST_DOSE', 'keep:TRAINS']);
    expect(result.decisions.some((d) => d.stackItemId === 'cr' && d.kind === 'clear')).toBe(false);
  });
  it('creatine for someone who says they do not train can be let go, kindly', () => {
    const { result } = run([stackItem('cr', 'creatine-monohydrate', { answers: { trains: false } })]);
    expect(of(result, 'cr')).toEqual(['clear:NOT_TRAINING']);
  });
});

describe('decide: overlap is settled as a group', () => {
  it('keeps the better-evidenced, better-value one of two sleep aids', () => {
    const { result } = run([
      stackItem('gum', 'sleep-gummies-blend', { origin: 'online' }),
      stackItem('mel', 'melatonin'),
    ]);
    expect(of(result, 'gum')).toEqual(['clear:OVERLAP']);
    const d = result.decisions.find((x) => x.stackItemId === 'gum')!;
    expect(d.context.keeperName).toBe('Melatonin');
    expect(of(result, 'mel')).toEqual(['keep:EVIDENCE_REGULAR']);
  });
  it('keeps the gym they use, and offers to let the other go', () => {
    const { result } = run([
      stackItem('eq', 'premium-gym-membership-equinox-life-time', { answers: { visitsLast30Days: 11 } }),
      stackItem('pf', 'gym-membership', { answers: { visitsLast30Days: 1 } }),
    ]);
    expect(of(result, 'pf')).toEqual(['clear:OVERLAP']);
    expect(of(result, 'eq')).toEqual(['keep:EVIDENCE_REGULAR']);
  });
  it('never clears a loved member of a group', () => {
    const { result } = run(
      [
        stackItem('eq', 'premium-gym-membership-equinox-life-time', { answers: { visitsLast30Days: 11 } }),
        stackItem('pf', 'gym-membership', { answers: { visitsLast30Days: 1 } }),
      ],
      (p) => {
        p.values.pf = { attachment: 'loved', reasons: ['where my dad and I lift'], from: 'note' };
      },
    );
    // Loved and an anchor: kept, and offered as the centre of their week.
    expect(of(result, 'pf')).toEqual(['curate:ANCHOR', 'keep:LOVED']);
  });
});

describe('decide: the clearing rules', () => {
  it('clears feed-bought, weakly supported things nobody loves', () => {
    const { result } = run([stackItem('ag1', 'greens-powder-ag1-etc', { origin: 'online' })]);
    expect(of(result, 'ag1')).toEqual(['clear:BORROWED_WEAK']);
    expect(result.decisions.find((d) => d.stackItemId === 'ag1')!.money).toBe(99);
  });
  it('never calls this person a feed buyer because other people are', () => {
    const { result } = run([stackItem('ag1', 'greens-powder-ag1-etc')]);
    // Never a clear on other people's habits: at most a curious question.
    expect(of(result, 'ag1')).toEqual(['curate:WORTH_A_LOOK', 'keep:NOTHING_TO_CLEAR']);
  });
  it('unused comes first', () => {
    const { result } = run([
      stackItem('ag1', 'greens-powder-ag1-etc', { origin: 'online', answers: { usesLast30Days: 0 } }),
    ]);
    expect(of(result, 'ag1')).toEqual(['clear:UNUSED']);
  });
  it('asks before naming a habit people often share, with no "stays" card meanwhile; nicotine is named', () => {
    const { result } = run([
      stackItem('wine', 'alcohol-in-the-evening'),
      stackItem('nic', 'nicotine-pouches-vape'),
    ]);
    expect(of(result, 'wine')).toEqual([]);
    expect(of(result, 'nic')).toEqual(['clear:UNLOVED_HABIT']);
  });
  it('offers a swap for a habit that costs them even when loved; tied to people, a tradition or a job, it is theirs', () => {
    const alone = run([stackItem('wine', 'alcohol-in-the-evening')], (p) => {
      p.values.wine = { attachment: 'neutral', reasons: ['a glass on my own most nights'], from: 'note' };
    });
    expect(of(alone.result, 'wine')).toEqual(['clear:UNLOVED_HABIT']);
    // Enjoying it doesn't change the advice (Veer, 25 Oct 2026): the swap keeps the part they like.
    const enjoyed = run([stackItem('wine', 'alcohol-in-the-evening')], (p) => {
      p.values.wine = { attachment: 'loved', reasons: ['my favourite part of the day, a glass on the couch'], from: 'note' };
    });
    expect(of(enjoyed.result, 'wine')).toEqual(['clear:UNLOVED_HABIT']);
    const shared = run([stackItem('wine', 'alcohol-in-the-evening')], (p) => {
      p.values.wine = { attachment: 'loved', reasons: ['Fridays Sam and I open a bottle'], from: 'note' };
    });
    // Theirs, and never offered as the anchor of their week.
    expect(of(shared.result, 'wine')).toEqual(['keep:THEIRS']);
    const shop = run([stackItem('cof', 'nicotine-pouches-vape', { notes: [{ id: 'n', text: 'Smoke break with the crew at the shop.', at: '2026-10-20T10:00:00Z' }] })]);
    expect(of(shop.result, 'cof')).toEqual(['keep:THEIRS']);
    const job = run([stackItem('nic', 'nicotine-pouches-vape', { notes: [{ id: 'n', text: "It's part of the job on night shifts.", at: '2026-10-20T10:00:00Z' }] })]);
    expect(of(job.result, 'nic')).toEqual(['keep:THEIRS']);
    // A swap keeps the habit, so it frees no money.
    expect(alone.result.decisions.find((d) => d.stackItemId === 'wine')!.money).toBe(0);
  });
  it('doubling up on skin is offered as one simpler routine', () => {
    const { result } = run([stackItem('ex', 'two-exfoliants-scrub-plus-acid-or-two-acids')]);
    expect(of(result, 'ex')).toEqual(['clear:TOO_MANY_STEPS']);
  });
  it('unknown evidence is not weak evidence: a row nobody reviewed is never cleared as noise', () => {
    // collagen-peptides has no V4 row in the fixture, so it reads as tier U.
    const feed = run([stackItem('col', 'collagen-peptides', { origin: 'online' })]);
    expect(of(feed.result, 'col')).toEqual(['keep:NOTHING_TO_CLEAR']);
    const unused = run([stackItem('col', 'collagen-peptides', { answers: { usesLast30Days: 0 } })]);
    expect(of(unused.result, 'col')).toEqual(['clear:UNUSED']);
  });
});

describe('decide: memory and order', () => {
  const items = () => [
    stackItem('ag1', 'greens-powder-ag1-etc', { origin: 'online' }),
    stackItem('gum', 'sleep-gummies-blend', { origin: 'online' }),
    stackItem('mel', 'melatonin'),
    stackItem('eq', 'premium-gym-membership-equinox-life-time', { answers: { visitsLast30Days: 11 } }),
    stackItem('pf', 'gym-membership', { answers: { visitsLast30Days: 1 } }),
    stackItem('cr', 'creatine-monohydrate', { answers: { dose: 2, doseUnit: 'g' } }),
    stackItem('wine', 'alcohol-in-the-evening'),
    stackItem('nic', 'nicotine-pouches-vape'),
    stackItem('sun', 'sunscreen-daily-spf-30'),
    stackItem('ex', 'two-exfoliants-scrub-plus-acid-or-two-acids'),
  ];
  it('gives the same decisions whatever order their list is in', () => {
    const baseline = run(items()).result.decisions;
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 25; i++) {
      const shuffled = items().sort(() => rand() - 0.5);
      expect(run(shuffled).result.decisions).toEqual(baseline);
    }
  });
  it('"not now" holds for its cooldown, then the proposal can come back', () => {
    const soon = run(items(), () => {}, [
      { stackItemId: 'ag1', kind: 'clear', reason: 'BORROWED_WEAK', status: 'not-now', answeredAt: '2026-10-16T10:00:00Z' },
    ]);
    expect(of(soon.result, 'ag1')).toEqual([]);
    const later = run(items(), () => {}, [
      { stackItemId: 'ag1', kind: 'clear', reason: 'BORROWED_WEAK', status: 'not-now', answeredAt: '2026-09-20T10:00:00Z' },
    ]);
    expect(of(later.result, 'ag1')).toEqual(['clear:BORROWED_WEAK']);
  });
  it('a yes is never asked again, even before the app marks the item gone', () => {
    const answered = run(items(), () => {}, [
      { stackItemId: 'ag1', kind: 'clear', reason: 'BORROWED_WEAK', status: 'yes', answeredAt: '2026-10-20T10:00:00Z' },
    ]);
    expect(of(answered.result, 'ag1')).toEqual([]);
  });
  it('never proposes clearing a well-founded thing done regularly, unless something kept covers it', () => {
    const { result } = run(items());
    for (const d of result.decisions.filter((x) => x.kind === 'clear')) {
      const view = catalogView.item(d.itemKey);
      const tier = d.evidenceTier;
      if (view?.evidenceDirection === 'benefit' && (tier === 'A' || tier === 'B'))
        expect(d.reason).toBe('OVERLAP');
    }
  });
});

describe('mixed evidence that costs money', () => {
  it('asks whether they can feel it, and offers to let it go when they can’t', () => {
    // One question at a time: how often first, then whether they can feel it.
    const first = run([stackItem('gun', 'percussion-massage-gun', { monthlyCost: 10 })]);
    expect(valuableQuestions(first.input).filter((q) => q.stackItemId === 'gun').map((q) => q.variable)).toEqual(['usage']);
    const asked = run([stackItem('gun', 'percussion-massage-gun', { monthlyCost: 10, answers: { usesLast30Days: 12 } })]);
    const card = valuableQuestions(asked.input).find((q) => q.id === 'q:gun:feel')!;
    expect(card.text).toBe('Can you feel Massage gun doing something for you?');
    expect(card.options.map((o) => o.label)).toEqual(['Yes, I can tell', 'Not really', 'Not sure']);
    // No reason to change it yet: no card says it "stays".
    expect(of(asked.result, 'gun')).toEqual(['keep:NOTHING_TO_CLEAR']);
    const no = run([stackItem('gun', 'percussion-massage-gun', { monthlyCost: 10, answers: { usesLast30Days: 12, feels: false } })]);
    expect(of(no.result, 'gun')).toEqual(['clear:NOT_FELT']);
    expect(no.result.decisions.find((d) => d.stackItemId === 'gun')!.money).toBe(10);
    const yes = run([stackItem('gun', 'percussion-massage-gun', { monthlyCost: 10, answers: { usesLast30Days: 12, feels: true } })]);
    expect(of(yes.result, 'gun')).toEqual(['keep:NOTHING_TO_CLEAR']);
    expect(valuableQuestions(yes.input).some((q) => q.id === 'q:gun:feel')).toBe(false);
  });
  it('never asks about free things, things they love, or well-founded ones', () => {
    const free = run([stackItem('gun', 'percussion-massage-gun', { monthlyCost: 0 })]);
    expect(valuableQuestions(free.input).some((q) => q.variable === 'feel')).toBe(false);
    const loved = run([stackItem('gun', 'percussion-massage-gun', { monthlyCost: 10 })], (p) => {
      p.values.gun = { attachment: 'loved', reasons: ['best part of my evening'], from: 'note' };
    });
    expect(valuableQuestions(loved.input).some((q) => q.variable === 'feel')).toBe(false);
    const founded = run([stackItem('sun', 'sunscreen-daily-spf-30', { monthlyCost: 15, answers: { feels: false } })]);
    expect(of(founded.result, 'sun')).not.toContain('clear:NOT_FELT');
  });
});

describe('consistency', () => {
  const train = { trains: true };
  it('offers to anchor something that only works daily, done now and then', () => {
    const { result } = run([
      stackItem('cr', 'creatine-monohydrate', { answers: { ...train, usesLast30Days: 12, dose: 5, doseUnit: 'g' } }),
      stackItem('sun', 'sunscreen-daily-spf-30', { answers: { usesLast30Days: 28 } }),
    ]);
    // Still well-founded: kept, and offered a place next to something they already do.
    expect(of(result, 'cr')).toEqual(['curate:PAIR', 'keep:TRAINS']);
    const pair = result.decisions.find((d) => d.stackItemId === 'cr' && d.reason === 'PAIR')!;
    expect(pair.context.anchorName).toBe('your morning coffee or breakfast');
    expect(pair.money).toBe(0);
  });
  it('never for things that work on the day, things done daily already, or anything already anchored', () => {
    const daily = run([stackItem('cr', 'creatine-monohydrate', { answers: { ...train, usesLast30Days: 28, dose: 5, doseUnit: 'g' } })]);
    expect(of(daily.result, 'cr')).not.toContain('curate:PAIR');
    const paired = run([stackItem('cr', 'creatine-monohydrate', { answers: { ...train, usesLast30Days: 12, dose: 5, doseUnit: 'g', paired: true } })]);
    expect(of(paired.result, 'cr')).toEqual(['keep:TRAINS']);
    // Sunscreen in the fixture doesn't build (builds: false): no offer however often.
    const sun = run([stackItem('sun', 'sunscreen-daily-spf-30', { answers: { usesLast30Days: 6 } })]);
    expect(of(sun.result, 'sun')).not.toContain('curate:PAIR');
  });
  it('anchors to something they truly do every day at that time, never to another thing done now and then', () => {
    const items = [
      stackItem('cr', 'creatine-monohydrate', { answers: { ...train, usesLast30Days: 10, dose: 5, doseUnit: 'g' } }),
      stackItem('mel', 'melatonin', { answers: { usesLast30Days: 30 } }),
    ];
    const { result } = run(items);
    // Melatonin sits at night; creatine in the morning: no anchor at that time, so the moment itself.
    expect(result.decisions.find((d) => d.reason === 'PAIR')!.context.anchorName).toBe('your morning coffee or breakfast');
  });
});

describe('questions worth asking', () => {
  it('asks only questions whose answers change what Distill does', () => {
    const { input } = run([
      stackItem('ag1', 'greens-powder-ag1-etc'),
      stackItem('cr', 'creatine-monohydrate'),
      stackItem('sun', 'sunscreen-daily-spf-30'),
      stackItem('wine', 'alcohol-in-the-evening'),
    ]);
    const qs = valuableQuestions(input);
    const ids = qs.map((q) => q.id);
    expect(ids).toContain('q:ag1:origin');
    expect(ids).toContain('q:cr:trains');
    expect(ids).toContain('q:wine:company');
    // Sunscreen is kept whatever they say about where it came from: nothing to ask.
    expect(ids.some((id) => id.startsWith('q:sun:'))).toBe(false);
    // The $99 question comes before the $14 one.
    expect(ids.indexOf('q:ag1:origin')).toBeLessThan(ids.indexOf('q:cr:trains'));
  });

  it("words each card so its buttons fit, and lets them say they're not sure", () => {
    const { input } = run([
      stackItem('ag1', 'greens-powder-ag1-etc', { monthlyCost: 99 }),
      stackItem('cr', 'creatine-monohydrate', { monthlyCost: 14 }),
      stackItem('wine', 'alcohol-in-the-evening', { monthlyCost: 60 }),
    ]);
    const qs = valuableQuestions(input);
    const byId = (id: string) => qs.find((q) => q.id === id)!;
    // The catalog's own questions ("Do you lift, or is it more for focus?") are background for
    // Claude: a yes/no card always asks a yes/no question.
    expect(byId('q:cr:trains').text).toBe('Do you lift or train hard most weeks?');
    expect(byId('q:wine:company').text).toMatch(/more about the company, or a habit on your own\?$/);
    for (const q of qs) expect(q.options.at(-1)).toEqual({ label: NOT_SURE, patch: { kind: 'unsure', stackItemId: q.stackItemId } });
    // Not sure changes nothing they told us.
    expect(withPatch(input, { kind: 'unsure', stackItemId: 'ag1' })).toBe(input);
  });

  it("asks where it came from in the item's own words when the catalog has them", () => {
    const view = {
      ...catalogView,
      item: (key: string | null) => {
        const v = catalogView.item(key);
        return v && key === 'greens-powder-ag1-etc' ? { ...v, originQuestion: 'How did greens powder find its way into your mornings?' } : v;
      },
    };
    const { input } = run([stackItem('ag1', 'greens-powder-ag1-etc', { monthlyCost: 99 })]);
    const q = valuableQuestions({ ...input, catalog: view }).find((x) => x.id === 'q:ag1:origin')!;
    expect(q.text).toBe('How did greens powder find its way into your mornings?');
    expect(q.options.map((o) => o.label)).toEqual(['A feed or an ad', 'A friend', 'A podcast', 'My doctor', 'I found it myself', NOT_SURE]);
    expect(valuableQuestions(input).find((x) => x.id === 'q:ag1:origin')!.text).toBe('Where did Greens powder come from?');
  });
});

describe('decide: worth a look, and memberships we know nothing about', () => {
  it('asks, gently, about something with no evidence when we do not know where it came from', () => {
    const { result } = run([stackItem('ag1', 'greens-powder-ag1-etc')]);
    expect(of(result, 'ag1')).toEqual(['curate:WORTH_A_LOOK', 'keep:NOTHING_TO_CLEAR']);
  });
  it('offers the clear once they say it came from online, or a yes marked it borrowed', () => {
    expect(of(run([stackItem('ag1', 'greens-powder-ag1-etc', { origin: 'online' })]).result, 'ag1')).toEqual(['clear:BORROWED_WEAK']);
    const borrowed = run([stackItem('ag1', 'greens-powder-ag1-etc')], (p) => {
      p.values.ag1 = { attachment: 'borrowed', reasons: [], from: 'tap' };
    });
    expect(of(borrowed.result, 'ag1')).toEqual(['clear:BORROWED_WEAK']);
  });
  it('never asks about something well-founded or theirs', () => {
    expect(of(run([stackItem('cr', 'creatine-monohydrate')]).result, 'cr')).not.toContain('curate:WORTH_A_LOOK');
    expect(of(run([stackItem('ag1', 'greens-powder-ag1-etc', { status: 'kept' })]).result, 'ag1')).toEqual(['keep:THEIRS']);
  });
  it('does not praise a membership as real work until we know they use it', () => {
    const unknown = of(run([stackItem('eq', 'premium-gym-membership-equinox-life-time')]).result, 'eq');
    expect(unknown).not.toContain('keep:TRAINS');
    expect(unknown).not.toContain('keep:EVIDENCE_REGULAR');
    const used = of(run([stackItem('eq', 'premium-gym-membership-equinox-life-time', { answers: { visitsLast30Days: 12 } })]).result, 'eq');
    expect(used.some((x) => x === 'keep:TRAINS' || x === 'keep:EVIDENCE_REGULAR')).toBe(true);
  });
});

describe('decide: nothing to free', () => {
  it('never offers to clear, or asks about, a free thing already bought', () => {
    const lamp = of(run([stackItem('lamp', 'salt-lamp', { origin: 'friend', monthlyCost: 0 })]).result, 'lamp');
    expect(lamp).toEqual(['keep:NOTHING_TO_CLEAR']);
  });
});
