'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useProgress } from '../progress/context';
import type { Progress } from '../progress/types';
import { engineApi, type EngineResult, type EngineState } from './client';

/** Onboarding is behind them once they reach these steps; the first Ritual can be made. */
const PAST_ONBOARDING = new Set<Progress['step']>(['ready', 'invitation', 'connect', 'done', 'day-one']);

export interface EngineContextValue {
  /** Signed in, so there is an engine to talk to. Signed out, screens show the rules-only preview. */
  readonly on: boolean;
  readonly state: EngineState | null;
  readonly error: string | null;
  readonly busy: boolean;
  /** The newest result: the reply, a stack change to confirm, a feeling to confirm, explore options. */
  readonly last: EngineResult | null;
  /** Runs one call, keeps its state, and returns it (null when it failed). */
  readonly act: (
    call: () => Promise<EngineResult>,
    opts?: { saveFirst?: boolean; save?: Progress },
  ) => Promise<EngineResult | null>;
  readonly clearLast: () => void;
}

/** Exported for tests and previews that supply a state directly. */
export const EngineContext = createContext<EngineContextValue | null>(null);

/** Everything they keep on their list that the engine decides on. A change re-runs the rules. */
const listSignature = (p: Progress) =>
  JSON.stringify(p.items.map((i) => [i.id, i.itemKey, i.status, i.origin ?? null, i.answers, i.monthlyCost]));

export function EngineProvider({ children }: { children: ReactNode }) {
  const { ready, progress, store, saveNow } = useProgress();
  const on = ready && store.id === 'supabase';
  const [state, setState] = useState<EngineState | null>(null);
  const [last, setLast] = useState<EngineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const synced = useRef<string | null>(null);
  const composing = useRef(false);

  const act = useCallback(
    async (call: () => Promise<EngineResult>, opts: { saveFirst?: boolean; save?: Progress } = {}) => {
      setBusy(true);
      setError(null);
      try {
        // The engine reads their list from the server, so it has to be saved there first. A screen
        // that just changed it passes the new progress, since this render's copy is a step behind.
        if (opts.save) {
          await saveNow(opts.save);
          synced.current = listSignature(opts.save);
        } else if (opts.saveFirst) await saveNow();
        const result = await call();
        setState(result.state);
        setLast(result);
        return result;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'request_failed');
        return null;
      } finally {
        setBusy(false);
      }
    },
    [saveNow],
  );

  // First load: last night's check, and the state.
  useEffect(() => {
    if (!on) return;
    let alive = true;
    engineApi
      .open()
      .then((r) => {
        if (!alive) return;
        setState(r.state);
        if (r.reply) setLast(r);
      })
      .catch(() => alive && setError('load_failed'));
    return () => {
      alive = false;
    };
  }, [on]);

  // Once onboarding is done, the first Ritual is made (rules always; Claude when it is on).
  useEffect(() => {
    if (!on || !state || state.ritual.status !== 'none' || composing.current) return;
    if (!PAST_ONBOARDING.has(progress.step)) return;
    composing.current = true;
    synced.current = listSignature(progress);
    void act(() => engineApi.run({ kind: 'onboarding' }), { saveFirst: true });
  }, [on, state, progress, act]);

  // Their list changed (let go, kept, added, an answer about it): the rules run again.
  const signature = listSignature(progress);
  useEffect(() => {
    if (!on || !state || state.ritual.status === 'none') return;
    if (synced.current === null) {
      synced.current = signature;
      return;
    }
    if (synced.current === signature) return;
    const timer = setTimeout(() => {
      synced.current = signature;
      void act(() => engineApi.run({ kind: 'stack-change' }), { saveFirst: true });
    }, 1200);
    return () => clearTimeout(timer);
  }, [on, state, signature, act]);

  const value = useMemo<EngineContextValue>(
    () => ({ on, state, error, busy, last, act, clearLast: () => setLast(null) }),
    [on, state, error, busy, last, act],
  );
  return <EngineContext.Provider value={value}>{children}</EngineContext.Provider>;
}

/** Outside the app's screens (a test, the onboarding) there is no engine: everything reads as off. */
const OFF: EngineContextValue = {
  on: false,
  state: null,
  error: null,
  busy: false,
  last: null,
  act: async () => null,
  clearLast: () => {},
};

export function useEngine(): EngineContextValue {
  return useContext(EngineContext) ?? OFF;
}
