'use server';

import type { Item } from '@distill/catalog';
import { catalog } from '../catalog/server';
import type { Progress } from '../progress/types';
import { buildRoutedStack } from './routed';
import type { RoutedStack } from './types';

const items = new Map<string, Item>(catalog.items.map((i) => [i.key, i]));

/**
 * Routes the person's stack on the server, where the catalog and the engine already live, so the
 * browser never downloads the routing table. Progress stays in the browser; it is sent, read, and
 * not stored here.
 */
export async function routeProgress(
  input: Pick<Progress, 'items' | 'goals' | 'dataSource' | 'prefilledFrom'>,
): Promise<RoutedStack> {
  return buildRoutedStack(
    { items: input.items.slice(0, 300), goals: input.goals, dataSource: input.dataSource, prefilledFrom: input.prefilledFrom },
    items,
  );
}
