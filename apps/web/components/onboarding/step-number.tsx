'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

const StepNumberContext = createContext<{
  override: number | null;
  setOverride: (n: number | null) => void;
} | null>(null);

/** Lets a screen that holds two steps (tap, then "anything we missed") say which one the bar shows. */
export function StepNumberProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<number | null>(null);
  const value = useMemo(() => ({ override, setOverride }), [override]);
  return <StepNumberContext.Provider value={value}>{children}</StepNumberContext.Provider>;
}

export function useStepNumber(n: number | null) {
  const set = useContext(StepNumberContext)?.setOverride;
  useEffect(() => {
    if (!set) return;
    set(n);
    return () => set(null);
  }, [set, n]);
}

export function useStepOverride(): number | null {
  return useContext(StepNumberContext)?.override ?? null;
}
