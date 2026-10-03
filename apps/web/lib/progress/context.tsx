'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { LocalProgressStore } from './local';
import { emptyProgress } from './types';
import type { Progress, ProgressStore } from './types';

type Patch = Partial<Progress> | ((current: Progress) => Progress);

interface ProgressContextValue {
  /** False until the saved progress has been read, so screens can show a skeleton instead of a flash. */
  ready: boolean;
  progress: Progress;
  update: (patch: Patch) => void;
  reset: () => Promise<void>;
  store: ProgressStore;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

/** Loads saved progress once, then saves every change after a short pause. */
export function ProgressProvider({
  children,
  store: given,
}: {
  children: ReactNode;
  store?: ProgressStore;
}) {
  const store = useMemo(() => given ?? new LocalProgressStore(), [given]);
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [ready, setReady] = useState(false);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    store.load().then((saved) => {
      if (!alive) return;
      if (saved) setProgress(saved);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [store]);

  useEffect(() => {
    if (!ready || !dirty.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      dirty.current = false;
      void store.save(progress);
    }, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [progress, ready, store]);

  useEffect(() => {
    const flush = () => {
      if (dirty.current) {
        dirty.current = false;
        void store.save(progress);
      }
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [progress, store]);

  const update = useCallback((patch: Patch) => {
    dirty.current = true;
    setProgress((current) => {
      const next = typeof patch === 'function' ? patch(current) : { ...current, ...patch };
      return { ...next, updatedAt: new Date().toISOString() };
    });
  }, []);

  const reset = useCallback(async () => {
    dirty.current = false;
    await store.clear();
    setProgress(emptyProgress());
  }, [store]);

  const value = useMemo(
    () => ({ ready, progress, update, reset, store }),
    [ready, progress, update, reset, store],
  );
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress needs a ProgressProvider');
  return ctx;
}
