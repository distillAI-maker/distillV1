import { describe, expect, it } from 'vitest';
import type { RitualPart } from '@distill/engine/ritual';
import { revealGroups } from '../ritual-groups';
import { withAnchors, withDetail } from './reveal';

const part = (id: string, slot: RitualPart['when']['slot'], extra: Partial<RitualPart> = {}): RitualPart => ({
  id: `part:${id}`,
  when: { slot, days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] },
  order: 0,
  title: id,
  area: 'mind',
  why: 'Part of your days as they are.',
  source: { kind: 'stack', stackItemId: id, itemKey: `row-${id}` },
  status: 'active',
  lock: null,
  ...extra,
});

const detail = {
  wake: '07:00',
  bed: '23:00',
  evidenceFor: (key: string | null) => (key === 'row-creatine' ? 'strength gains in people who train' : undefined),
  wellFounded: ['creatine'],
};

describe('the rules version of a first Ritual', () => {
  it('places mornings after their wake-up and nights before their bedtime', () => {
    const parts = withDetail(
      [part('a', 'morning', { order: 0 }), part('b', 'morning', { order: 1 }), part('c', 'morning', { order: 2 }), part('tea', 'night', { order: 3 }), part('book', 'night', { order: 4 })],
      detail,
    );
    expect(parts.map((p) => p.when.at)).toEqual(['07:15', '07:15', '07:30', '22:15', '22:30']);
  });

  it('never moves what already has a time, or anything when it does not know the time', () => {
    const fixed = part('run', 'morning', { when: { slot: 'morning', days: [], at: '06:00' } });
    expect(withDetail([fixed], detail)[0]!.when.at).toBe('06:00');
    expect(withDetail([part('a', 'morning')], { ...detail, wake: null })[0]!.when.at).toBeUndefined();
  });

  it('says what a well-founded thing is for, and whose a locked thing is', () => {
    const [creatine, walk, wine, pill] = withDetail(
      [
        part('creatine', 'morning'),
        part('walk', 'evening'),
        part('wine', 'evening', { lock: 'theirs' }),
        part('pill', 'morning', { lock: 'clinician', why: 'From your doctor, exactly as you do it. Distill never changes it.' }),
      ],
      detail,
    );
    expect(creatine!.why).toBe('For strength gains in people who train.');
    expect(walk!.why).toBe('Part of your days as they are.');
    expect(wine!.why).toMatch(/never give this up/);
    expect(pill!.why).toMatch(/From your doctor/);
  });

  it('has a line under every row once it reaches the page, not a bare list', () => {
    const parts = withAnchors(withDetail([part('creatine', 'morning'), part('wine', 'evening', { lock: 'theirs' })], detail), {
      wake: '07:00',
      wakeLabel: '7:00',
      bed: '23:00',
      people: 'Friends',
    });
    const rows = revealGroups(parts, ['creatine']).flatMap((g) => g.rows);
    expect(rows.map((r) => r.title)).toEqual(['Up at 7:00', 'creatine', 'wine', 'Time with friends', 'In bed by 11:00 pm']);
    for (const row of rows) expect(row.why, row.title).toBeTruthy();
    expect(rows[0]!.when).toBe('Daily · 7:00');
    expect(rows[3]!.when).toBe('Weekly');
  });

  it('runs in the order the day is lived, with room for their people before the night', () => {
    const parts = withAnchors([part('tea', 'night', { order: 0 }), part('walk', 'evening', { order: 1 })], {
      bed: '23:00',
      people: 'Family',
    });
    expect(parts.map((p) => p.title)).toEqual(['walk', 'Time with family', 'tea', 'In bed by 11:00 pm']);
    expect(parts.map((p) => p.order)).toEqual([0, 1, 2, 3]);
  });

  it('adds no anchors for what they never said, and no room they already have', () => {
    expect(withAnchors([part('a', 'morning')], {}).map((p) => p.title)).toEqual(['a']);
    const drinks = part('drinks', 'evening', { title: 'A drink with friends' });
    expect(withAnchors([drinks], { people: 'Friends' }).map((p) => p.title)).toEqual(['A drink with friends']);
  });
});
