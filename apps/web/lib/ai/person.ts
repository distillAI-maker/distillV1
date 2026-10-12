import { shortName } from '../catalog/short-names';
import { copy } from '../copy';
import type { RoutedItem, RoutedStack } from '../data/types';
import type { PictureKind, PictureLine, Progress } from '../progress/types';
import { newItemId } from '../progress/types';

/**
 * What Claude is told about a person: their values, in their words (docs/DIRECTION.md, "How Distill
 * decides"). Built on the device from their progress and sent with each request; nothing is kept on
 * the server.
 */
export interface RitualContext {
  name: string;
  kind?: string;
  /** Routing-table row, so the server can add what the evidence says. */
  itemKey?: string | null;
  /** Marked "This is mine", or kept. */
  theirs: boolean;
  letGo: boolean;
  essence?: string;
  notes: string[];
}

export interface PersonContext {
  name: string;
  idealDay: string;
  goals: string[];
  rituals: RitualContext[];
  answers: { q: string; a: string }[];
  picture: { kind: PictureKind; text: string; theirs: boolean }[];
  removed: string[];
}

/** What it is, under their own word for it: "Barry's" reads "Boutique classes". */
export function kindOf(r: RoutedItem, progress: Progress): string {
  const own = progress.items.find((i) => i.id === r.stackItemId)?.label;
  const kind = own && r.itemKey ? shortName(r.itemKey, '') : '';
  return kind || copy.stack.categories[r.category as keyof typeof copy.stack.categories];
}

export function personOf(progress: Progress, routed: RoutedStack): PersonContext {
  return {
    name: progress.name.trim().split(/\s+/)[0] ?? '',
    idealDay: progress.lifeText,
    goals: progress.goals,
    rituals: routed.items.flatMap((r) => {
      const item = progress.items.find((i) => i.id === r.stackItemId);
      if (!item || item.dataSource) return [];
      return [
        {
          name: r.name,
          kind: kindOf(r, progress),
          itemKey: r.itemKey,
          theirs: item.status === 'kept' || progress.dayOne.yours.includes(item.id),
          letGo: item.status === 'cut',
          essence: item.essence,
          notes: item.notes.map((n) => n.text),
        },
      ];
    }),
    answers: progress.asks.slice(-12).map(({ q, a }) => ({ q, a })),
    picture: (progress.picture?.lines ?? []).map((l) => ({
      kind: l.kind,
      text: l.text,
      theirs: l.by === 'you',
    })),
    removed: progress.picture?.removed ?? [],
  };
}

/**
 * Folds Claude's lines into the picture. Lines they wrote or edited stay as they are; Claude's own
 * lines are replaced by its new set, keeping a line's id and date when its words did not change.
 * Returns the picture and the lines that are new.
 */
export function mergePicture(
  current: Progress['picture'],
  fromClaude: { kind: PictureKind; text: string }[],
  at = new Date().toISOString(),
): { picture: NonNullable<Progress['picture']>; added: string[] } {
  const lines = current?.lines ?? [];
  const removed = current?.removed ?? [];
  const key = (t: string) => t.trim().toLowerCase();
  const gone = new Set(removed.map(key));
  const theirs = lines.filter((l) => l.by === 'you');
  const taken = new Set(theirs.map((l) => key(l.text)));
  const before = new Map(lines.filter((l) => l.by === 'distill').map((l) => [key(l.text), l]));
  const added: string[] = [];
  const mine: PictureLine[] = [];
  for (const line of fromClaude) {
    const k = key(line.text);
    if (!k || gone.has(k) || taken.has(k)) continue;
    taken.add(k);
    const kept = before.get(k);
    if (kept) mine.push({ ...kept, kind: line.kind });
    else {
      mine.push({ id: newItemId(), kind: line.kind, text: line.text.trim(), by: 'distill', at });
      added.push(line.text.trim());
    }
  }
  return {
    picture: { lines: [...theirs, ...mine].slice(0, 40), removed, updatedAt: at },
    added,
  };
}
