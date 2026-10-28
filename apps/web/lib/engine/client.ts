'use client';

import type { EngineEvent } from '@distill/engine/ritual';
import type { EngineResult, EngineState } from '../../src/server/engine';
import { api } from '../api';

export type { EngineResult, EngineState };
export type RunEvent = Exclude<EngineEvent, { kind: 'message' } | { kind: 'night' }>;

const zone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    return '';
  }
};

function call<T>(path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const tz = zone();
  if (tz) headers['x-time-zone'] = tz;
  return api<T>(
    `/api/app/engine/${path}`,
    body === undefined ? { headers } : { method: 'POST', headers, body: JSON.stringify(body) },
  );
}

/** The app's calls into the engine (src/server/engine-routes.ts). Signed in only. */
export const engineApi = {
  state: () => call<EngineState>('state'),
  /** On open: last night's check, if it hasn't run, and the state either way. */
  open: () => call<EngineResult>('night-check', {}),
  run: (event: RunEvent) => call<EngineResult>('run', { event }),
  message: (text: string, about?: string) => call<EngineResult>('message', about ? { text, about } : { text }),
  accept: (versionId: string) => call<EngineResult>('accept', { versionId }),
  undo: (versionId: string) => call<EngineResult>('undo', { versionId }),
  settings: (nightsShapeMornings: boolean) => call<EngineResult>('settings', { nightsShapeMornings }),
  explore: (want: string, region?: string) =>
    call<EngineResult>('explore', region ? { want, region } : { want }),
  exploreAnswer: (ideaId: string, answer: 'add' | 'decline') =>
    call<EngineResult>('explore-answer', { ideaId, answer }),
  swapAnswer: (itemKey: string, answer: 'add' | 'decline') =>
    call<EngineResult>('swap-answer', { itemKey, answer }),
};
