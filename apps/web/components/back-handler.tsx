'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';

type Handler = () => boolean;

const BackContext = createContext<{
  handler: Handler | null;
  setHandler: Dispatch<SetStateAction<Handler | null>>;
} | null>(null);

/** Lets a screen take over the bar's Back button (the question flow steps back one question). */
export function BackProvider({ children }: { children: ReactNode }) {
  const [handler, setHandler] = useState<Handler | null>(null);
  const value = useMemo(() => ({ handler, setHandler }), [handler]);
  return <BackContext.Provider value={value}>{children}</BackContext.Provider>;
}

export function useBackHandler(handler: Handler | null) {
  const ctx = useContext(BackContext);
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!ctx) return;
    // Wrapped twice: a bare function would be taken for a state updater and run at once.
    ctx.setHandler(() => () => (ref.current ? ref.current() : false));
    return () => ctx.setHandler(null);
  }, [ctx?.setHandler]);
}

export function useBack(): Handler | null {
  return useContext(BackContext)?.handler ?? null;
}
