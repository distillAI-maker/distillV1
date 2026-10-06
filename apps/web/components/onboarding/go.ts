'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useProgress } from '../../lib/progress/context';
import type { Progress } from '../../lib/progress/types';

/** Saves the step the person has reached, then moves there. */
export function useGo() {
  const router = useRouter();
  const { update } = useProgress();
  return useCallback(
    (step: Progress['step'], patch?: Partial<Progress>) => {
      update({ ...(patch ?? {}), step });
      router.push(step === 'done' ? '/today' : `/${step}`);
    },
    [router, update],
  );
}
