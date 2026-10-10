'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { LocalProgressStore } from './local';
import { emptyProgress } from './types';
import type { Progress, ProgressStore } from './types';
import { RemoteProgressStore } from './remote';

type Patch = Partial<Progress> | ((current: Progress) => Progress);

interface ProgressContextValue {
  /** False until the saved progress has been read, so screens can show a skeleton instead of a flash. */
  ready: boolean;
  progress: Progress;
  update: (patch: Patch) => void;
  reset: (memoryOnly?: boolean) => Promise<void>;
  saveNow: (value?: Progress) => Promise<void>;
  store: ProgressStore;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

/** Loads saved progress once, then saves every change after a short pause. */
export function ProgressProvider({
  children,
  store: given,
  userId,
}: {
  children: ReactNode;
  store?: ProgressStore;
  userId?: string;
}) {
  const store = useMemo(
    () => given ?? (userId ? new RemoteProgressStore(userId) : new LocalProgressStore()),
    [given, userId],
  );
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    setReady(false);
    setError(null);
    setProgress(emptyProgress());
    store
      .load()
      .then(async (saved) => {
        if (!alive) return;
        if (!saved && store.id === 'supabase') {
          // The email is asked at the invitation, after onboarding ran on this device: the first
          // sign-in carries that progress into the new account, then saves it there.
          const onDevice = await new LocalProgressStore().load().catch(() => null);
          if (!alive) return;
          if (onDevice) {
            dirty.current = true;
            setProgress(onDevice);
            setReady(true);
            return;
          }
        }
        if (saved) setProgress(saved);
        setReady(true);
      })
      .catch(() => alive && setError('Your saved progress could not be loaded. Please retry.'));
    return () => {
      alive = false;
    };
  }, [store, attempt]);

  useEffect(() => {
    if (!ready || !dirty.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      dirty.current = false;
      void store
        .save(progress)
        .then(() => setError(null))
        .catch(() => {
          dirty.current = true;
          setError('Your changes have not been saved. Please retry.');
        });
    }, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [progress, ready, store]);

  useEffect(() => {
    const flush = () => {
      if (dirty.current) {
        dirty.current = false;
        void store.save(progress).catch(() => {
          dirty.current = true;
        });
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

  const saveNow = useCallback(
    async (value = progress) => {
      if (timer.current) clearTimeout(timer.current);
      try {
        await store.save(value);
        dirty.current = false;
        setError(null);
      } catch (err) {
        dirty.current = true;
        setError('Your changes have not been saved. Please retry.');
        throw err;
      }
    },
    [progress, store],
  );

  const reset = useCallback(
    async (memoryOnly = false) => {
      dirty.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (!memoryOnly) await store.clear();
      setProgress(emptyProgress());
    },
    [store],
  );

  const value = useMemo(
    () => ({ ready, progress, update, reset, saveNow, store }),
    [ready, progress, update, reset, saveNow, store],
  );
  return (
    <ProgressContext.Provider value={value}>
      {error ? (
        <div className="notice" role="alert">
          {error}{' '}
          <button
            type="button"
            onClick={() =>
              ready ? void saveNow().catch(() => undefined) : setAttempt((a) => a + 1)
            }
          >
            Retry
          </button>
        </div>
      ) : null}
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress needs a ProgressProvider');
  return ctx;
}
