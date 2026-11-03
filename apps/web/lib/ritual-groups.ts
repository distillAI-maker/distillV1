import type { RitualPart } from '@distill/engine/ritual';
import { copy } from './copy';
import { timeColumn, whyLine } from './ritual-lines';

/**
 * The first Ritual, grouped as the reveal draws it: the morning, the day, the evening, and what
 * only happens at the weekend. Each part says when ("Daily · 7:00", "Sat · Sun"), and why.
 */

export interface RevealRow {
  readonly id: string;
  readonly title: string;
  readonly when: string;
  readonly why: string;
  readonly yours: boolean;
}

export interface RevealGroup {
  readonly key: 'morning' | 'day' | 'night' | 'weekend';
  readonly label: string;
  readonly rows: readonly RevealRow[];
}

const weekendOnly = (p: RitualPart) =>
  p.when.days.length > 0 && p.when.days.every((d) => d === 'sat' || d === 'sun');

/** "Daily · 7:00", "9:00 pm", "Mon · Wed · Fri", "3× a week". */
export function whenLine(when: RitualPart['when']): string {
  const days = timeColumn({ ...when, at: undefined });
  const clock = when.at ? timeColumn(when, '').lines.join(' ') : '';
  const dayText = days.lines.join(days.days ? ' · ' : ' ');
  return [dayText, clock].filter(Boolean).join(' · ');
}

export function revealGroups(parts: readonly RitualPart[], wellFounded: readonly string[] = []): RevealGroup[] {
  const founded = new Set(wellFounded);
  const active = [...parts].filter((p) => p.status === 'active').sort((a, b) => a.order - b.order);
  const groups: [RevealGroup['key'], RitualPart[]][] = [
    ['morning', active.filter((p) => !weekendOnly(p) && p.when.slot === 'morning')],
    ['day', active.filter((p) => !weekendOnly(p) && p.when.slot === 'midday')],
    ['night', active.filter((p) => !weekendOnly(p) && (p.when.slot === 'evening' || p.when.slot === 'night'))],
    ['weekend', active.filter(weekendOnly)],
  ];
  return groups
    .filter(([, ps]) => ps.length)
    .map(([key, ps]) => ({
      key,
      label: copy.app.ritual.sections[key],
      rows: ps.map((p) => {
        const item = p.source.kind === 'stack' ? p.source.stackItemId : null;
        return {
          id: p.id,
          title: p.title,
          when: whenLine(p.when),
          why: whyLine(p, { founded: !!item && founded.has(item) }),
          yours: p.lock === 'theirs',
        };
      }),
    }));
}
