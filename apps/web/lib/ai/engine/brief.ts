import type { CatalogItemView, CatalogView } from '@distill/catalog';
import {
  dayOf,
  seasonOn,
  type PersonModel,
  type RitualPart,
  type StackItemLike,
} from '@distill/engine/ritual';

/**
 * Prompt-sized views of a person, built on the server. Each sits in a tag the system prompt calls
 * their own material. Nothing in here goes into a system prompt, so the system prompt can cache.
 */

const clean = (t: string) => t.replace(/\s+/g, ' ').trim();
const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n).trimEnd()}…` : t);

/** The words they wrote, all in one place: what a quote must come from. */
export function theirWords(person: PersonModel, stack: readonly StackItemLike[], extra: readonly string[] = []): string {
  return [
    person.identity.idealDay,
    ...person.identity.atBest,
    ...person.identity.toward.map((t) => t.quote ?? t.text),
    ...stack.flatMap((s) => [s.customName ?? '', s.label ?? '', ...s.notes.map((n) => n.text)]),
    ...person.picture.filter((l) => l.by === 'you').map((l) => l.text),
    ...extra,
  ]
    .filter(Boolean)
    .join('\n');
}

export function personBlock(
  person: PersonModel,
  ctx: { today: string; lockedTitles?: readonly string[]; asks?: readonly { q: string; a: string }[] },
): string {
  const out = ['<person>'];
  if (person.name) out.push(`First name: ${clean(person.name)}`);
  if (person.identity.idealDay.trim()) out.push(`Their ideal day, in their words: ${clip(clean(person.identity.idealDay), 1500)}`);
  if (person.identity.atBest.length) out.push(`At their best: ${person.identity.atBest.map(clean).join('; ')}`);
  if (person.identity.toward.length)
    out.push(
      `Working toward: ${person.identity.toward
        .map((t) => `${clean(t.text)}${t.hard ? ' (a hard goal' + (t.by ? `, by ${t.by}` : '') + ')' : ''}`)
        .join('; ')}`,
    );
  if (person.people.length)
    out.push(`People: ${person.people.map((p) => `${p.name} [id ${p.id}]${p.what ? `: ${clean(p.what)}` : ''}`).join('; ')}`);
  if (person.places.length) out.push(`Places: ${person.places.map((p) => `${p.name}: ${clean(p.what)}`).join('; ')}`);
  const season = seasonOn(person, ctx.today);
  if (season !== 'steady') out.push(`Their season right now: ${season}`);
  if (ctx.lockedTitles?.length) out.push(`Parts of their Ritual that are theirs: ${ctx.lockedTitles.join('; ')}`);
  for (const a of (ctx.asks ?? []).slice(-8)) if (a.a.trim()) out.push(`They answered "${clean(a.q)}": ${clip(clean(a.a), 600)}`);
  out.push('</person>');
  return out.join('\n');
}

export function itemsBlock(person: PersonModel, stack: readonly StackItemLike[], catalog: CatalogView): string {
  const out = ['<items>'];
  for (const s of stack) {
    if (s.status === 'cut' || s.dataSource) continue;
    const v = catalog.item(s.itemKey);
    const name = s.label || s.customName || v?.name || 'something';
    out.push(`- id ${s.id}: ${clean(name)}${v ? ` (${v.kind})` : ''}; what we know: ${person.values[s.id]?.attachment ?? 'unknown'}`);
    for (const n of s.notes.slice(-6)) out.push(`  <notes>${clip(clean(n.text), 800)}</notes>`);
  }
  out.push('</items>');
  return out.join('\n');
}

const GRADE = { A: 'strong', B: 'good', C: 'mixed', D: 'weak', N: 'none', U: 'not reviewed yet' } as const;

export function evidenceBlock(view: CatalogItemView | undefined): string {
  if (!view || view.tier === 'U') return '<evidence>Not reviewed yet: say nothing about evidence.</evidence>';
  const about =
    view.evidenceDirection === 'cost'
      ? `How well supported the cost is: ${GRADE[view.tier]}`
      : `How well supported: ${GRADE[view.tier]}`;
  return `<evidence>\n${about}\nFor: ${clean(view.evidenceFor)}\n${clip(clean(view.evidenceSummary), 400)}\n</evidence>`;
}

export function partLine(p: RitualPart, flags: { locked?: boolean; protected?: boolean } = {}): string {
  const when = [p.when.at, p.when.slot, p.when.days.length === 7 ? 'every day' : p.when.days.join(' '), p.when.perWeek ? `${p.when.perWeek}x a week` : '']
    .filter(Boolean)
    .join(', ');
  const tags = [
    flags.locked || p.lock ? 'locked' : '',
    flags.protected ? 'protected' : '',
    p.people?.length ? `people: ${p.people.join(' ')}` : '',
  ]
    .filter(Boolean)
    .join('; ');
  return `- ${p.id} "${clean(p.title)}" (${when}${p.minutes ? `, ${p.minutes} min` : ''})${tags ? ` [${tags}]` : ''}`;
}

export function nowBlock(instant: string, timeZone: string, today: string, minute: number): string {
  const hh = String(Math.floor(minute / 60)).padStart(2, '0');
  const mm = String(minute % 60).padStart(2, '0');
  const names = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' } as const;
  void instant;
  return `<now>${names[dayOf(today)]} ${today} ${hh}:${mm} (${timeZone})</now>`;
}
