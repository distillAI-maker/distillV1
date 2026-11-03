'use client';

import { useCallback } from 'react';
import { useRouted } from '../../lib/data/use-routed';
import { useProgress } from '../../lib/progress/context';

/** What a person calls each thing on their list: their own label, the catalog's short name, or what they typed. */
export function useNames() {
  const { progress } = useProgress();
  const { routed } = useRouted();
  const nameOf = useCallback(
    (id: string | null | undefined) => {
      if (!id) return '';
      const item = progress.items.find((i) => i.id === id);
      return (
        item?.label ||
        routed?.items.find((r) => r.stackItemId === id)?.name ||
        item?.customName ||
        ''
      );
    },
    [progress.items, routed],
  );
  return { nameOf, routed };
}
