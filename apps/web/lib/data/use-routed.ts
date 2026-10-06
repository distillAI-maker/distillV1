'use client';

import { useEffect, useMemo, useState } from 'react';
import { useProgress } from '../progress/context';
import { routeProgress } from './route-action';
import { summarise } from './routed';
import type { DayOneSummary, RoutedStack } from './types';

/**
 * The person's stack, routed by the engine on the server. Re-routes when the stack, its answers or
 * the goals change; the person's own choices (keep anyway, overlaps, yours) are applied on top.
 */
export function useRouted(route: typeof routeProgress = routeProgress): {
  routed: RoutedStack | null;
  summary: DayOneSummary | null;
  failed: boolean;
  retry: () => void;
} {
  const { ready, progress } = useProgress();
  const [routed, setRouted] = useState<RoutedStack | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const input = useMemo(
    () => ({
      items: progress.items,
      goals: progress.goals,
      dataSource: progress.dataSource,
      prefilledFrom: progress.prefilledFrom,
    }),
    [progress.items, progress.goals, progress.dataSource, progress.prefilledFrom],
  );
  const key = JSON.stringify(input);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    setFailed(false);
    route(input)
      .then((r) => alive && setRouted(r))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
    // `key` stands for `input`: re-route only when what the engine reads has changed.
  }, [ready, key, attempt, route]);

  const summary = useMemo(() => (routed ? summarise(routed, progress.dayOne) : null), [routed, progress.dayOne]);
  return { routed, summary, failed, retry: () => setAttempt((a) => a + 1) };
}
