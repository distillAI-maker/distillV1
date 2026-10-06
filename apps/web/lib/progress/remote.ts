import { api } from '../api';
import { progressSchema } from './types';
import type { Progress, ProgressStore } from './types';

/** No device-cache fallback: an auth/network failure must never load another person's stack. */
export class RemoteProgressStore implements ProgressStore {
  readonly id = 'supabase' as const;
  constructor(private readonly userId: string) {}
  private pending: Promise<unknown> = Promise.resolve();
  async load() {
    const value = await api<unknown>('/api/app/progress', {}, this.userId);
    return value === null ? null : progressSchema.parse(value);
  }
  save(progress: Progress): Promise<void> {
    const next = this.pending
      .catch(() => undefined)
      .then(() =>
        api(
          '/api/app/progress',
          { method: 'POST', body: JSON.stringify(progressSchema.parse(progress)) },
          this.userId,
        ),
      );
    this.pending = next;
    return next.then(() => undefined);
  }
  async clear() {
    await this.pending.catch(() => undefined);
    await api('/api/app/progress', { method: 'DELETE' }, this.userId);
  }
}
