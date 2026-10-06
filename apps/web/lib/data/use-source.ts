'use client';

import type { VerdictTemplate } from '@distill/catalog';
import { useEffect, useMemo, useState } from 'react';
import { fetchVerdictTemplates } from '../catalog/actions';
import type { Progress } from '../progress/types';
import { createDemoSource } from './demo';
import type { DataSource } from './types';
import { useProgress } from '../progress/context';
import { createLiveSource } from './live';

/** No engine yet for live wearables (Phase 3 to 7): nothing runs, nothing is decided. */
export const noneSource: DataSource = {
  id: 'supabase',
  async experiments() {
    return [];
  },
  async verdicts() {
    return [];
  },
};

/** The data source for the person's connection. Templates load once, from the catalog. */
export function useDataSource(
  progress: Progress,
  loadTemplates: () => Promise<VerdictTemplate[]> = fetchVerdictTemplates,
): { source: DataSource | null; failed: boolean; retry: () => void } {
  const { store } = useProgress();
  const [templates, setTemplates] = useState<VerdictTemplate[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setFailed(false);
    loadTemplates()
      .then((t) => alive && setTemplates(t))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [attempt, loadTemplates]);
  const source = useMemo(() => {
    if (!templates) return null;
    if (store.id === 'supabase') return createLiveSource(() => setFailed(true));
    return progress.dataSource === 'demo' ? createDemoSource(templates) : noneSource;
  }, [templates, progress.dataSource, store, attempt]);
  return { source, failed, retry: () => setAttempt((a) => a + 1) };
}
