import { describe, expect, it } from 'vitest';
import { decide, type DecideInput } from './decide.js';
import { valuableQuestions } from './questions.js';
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
    expect(of(result, 'ag1')).toEqual(['keep:NOTHING_TO_CLEAR']);
  });
  it('unused comes first', () => {
    const { result } = run([
      stackItem('ag1', 'greens-powder-ag1-etc', { origin: 'online', answers: { usesLast30Days: 0 } }),
    ]);
    expect(of(result, 'ag1')).toEqual(['clear:UNUSED']);
  });
  it('asks before naming a habit people often share: drinks are asked about, nicotine is named', () => {
    const { result } = run([
      stackItem('wine', 'alcohol-in-the-evening'),
      stackItem('nic', 'nicotine-pouches-vape'),
    ]);
    expect(of(result, 'wine')).toEqual(['keep:NOTHING_TO_CLEAR']);
    expect(of(result, 'nic')).toEqual(['clear:UNLOVED_HABIT']);
  });
  it('a drink alone most nights is named kindly; Friday wine with people is kept', () => {
    const alone = run([stackItem('wine', 'alcohol-in-the-evening')], (p) => {
      p.values.wine = { attachment: 'neutral', reasons: ['a glass on my own most nights'], from: 'note' };
    });
    expect(of(alone.result, 'wine')).toEqual(['clear:UNLOVED_HABIT']);
    const loved = run([stackItem('wine', 'alcohol-in-the-evening')], (p) => {
      p.values.wine = { attachment: 'loved', reasons: ['Fridays Sam and I open a bottle'], from: 'note' };
    });
    expect(of(loved.result, 'wine')).toEqual(['keep:LOVED']);
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
});
