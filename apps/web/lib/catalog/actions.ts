'use server';

import type { Item, VerdictTemplate } from '@distill/catalog';
import { catalog, itemByKey } from './server';

/** Full catalog rows for the keys a person listed. Progress lives in the browser, so the client asks. */
export async function fetchItems(keys: string[]): Promise<Item[]> {
  const unique = [...new Set(keys)].slice(0, 300);
  return unique.map(itemByKey).filter((i): i is Item => Boolean(i));
}

/** The 17 verdict templates, for filling on the client. Small, and the only source of verdict words. */
export async function fetchVerdictTemplates(): Promise<VerdictTemplate[]> {
  return catalog.verdictTemplates;
}
