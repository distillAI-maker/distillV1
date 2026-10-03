import { progressSchema } from './types';
import type { Progress, ProgressStore } from './types';

export const localKey = 'distill.progress.v1';

/** Progress saved in this browser. Every read and write is guarded; storage can be absent. */
export class LocalProgressStore implements ProgressStore {
  readonly id = 'local' as const;
  constructor(private storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null = safeStorage()) {}
  async load(): Promise<Progress | null> {
    try {
      const text = this.storage?.getItem(localKey);
      if (!text) return null;
      const parsed = progressSchema.safeParse(JSON.parse(text));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }
  async save(progress: Progress): Promise<void> {
    try {
      this.storage?.setItem(localKey, JSON.stringify(progress));
    } catch {
      // Private windows and blocked storage: the screen still works, nothing persists.
    }
  }
  async clear(): Promise<void> {
    try {
      this.storage?.removeItem(localKey);
    } catch {
      // ignore
    }
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
