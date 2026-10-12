import type { RoutedStack } from '../data/types';
import type { Progress } from '../progress/types';
import { distillNotes, learnAbout } from './distill-action';
import { kindOf, mergePicture, personOf } from './person';

type Update = (patch: (current: Progress) => Progress) => void;

/**
 * Reads one ritual again from its notes and says what it gives them. With no notes left, what we
 * said about it goes too. Their notes stand on their own if Claude is off or fails.
 */
export async function rereadRitual(
  id: string,
  progress: Progress,
  routed: RoutedStack,
  update: Update,
): Promise<void> {
  const item = progress.items.find((i) => i.id === id);
  const r = routed.items.find((x) => x.stackItemId === id);
  if (!item || !r) return;
  const setItem = (change: Partial<typeof item>) =>
    update((p) => ({ ...p, items: p.items.map((i) => (i.id === id ? { ...i, ...change } : i)) }));
  if (!item.notes.length) {
    setItem({ essence: undefined, idea: undefined });
    return;
  }
  const result = await distillNotes({
    person: personOf(progress, routed),
    ritual: {
      name: r.name,
      kind: kindOf(r, progress),
      notes: item.notes.map((n) => n.text),
      declined: item.ideasDeclined,
    },
  });
  if (result.status === 'ok') setItem({ essence: result.line, idea: result.thought });
}

/**
 * Brings "What we've learned about you" up to date with everything they have shared. Returns the
 * lines that are new, so the moment can be shown back to them.
 */
export async function relearn(
  progress: Progress,
  routed: RoutedStack,
  update: Update,
): Promise<string[]> {
  const result = await learnAbout(personOf(progress, routed));
  if (result.status !== 'ok') return [];
  update((p) => ({ ...p, picture: mergePicture(p.picture, result.lines).picture }));
  return mergePicture(progress.picture, result.lines).added;
}
