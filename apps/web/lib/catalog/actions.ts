'use server';

import type { Item } from '@distill/catalog';
import { itemByKey } from './server';

/** Full catalog rows for the keys a person listed. Progress lives in the browser, so the client asks. */
export async function fetchItems(keys: string[]): Promise<Item[]> {
  const unique = [...new Set(keys)].slice(0, 300);
  return unique.map(itemByKey).filter((i): i is Item => Boolean(i));
}
