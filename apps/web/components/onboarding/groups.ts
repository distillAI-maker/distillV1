import { copy } from '../../lib/copy';
import { groupOf } from '../../lib/data/routed';
import type { Group } from '../../lib/data/routed';
import type { RoutedItem, RoutedStack } from '../../lib/data/types';
import type { Progress } from '../../lib/progress/types';

/** The four groups the person sees, in the Figma build's words, over the engine's six. */
export type Shelf = 'yours' | 'read' | 'go' | 'call';
export const shelfOf: Record<Group, Shelf> = {
  keep: 'yours',
  protected: 'yours',
  test: 'read',
  drop: 'go',
  cant: 'call',
  unread: 'call',
};
export const shelves: Shelf[] = ['yours', 'read', 'go', 'call'];

export function onShelves(routed: RoutedStack, dayOne: Progress['dayOne']): Record<Shelf, RoutedItem[]> {
  const out: Record<Shelf, RoutedItem[]> = { yours: [], read: [], go: [], call: [] };
  for (const r of routed.items) out[shelfOf[groupOf(r, routed, dayOne)]].push(r);
  return out;
}

/** The sentence for an item: where it actually landed, or a plain line for its group. */
export function sentenceOf(r: RoutedItem, group: Group): string {
  if (r.landing.sentence) return r.landing.sentence;
  if (r.landing.reason && group === 'drop') return copy.routing.reasonLine[r.landing.reason];
  return copy.routing.fallback[group];
}
