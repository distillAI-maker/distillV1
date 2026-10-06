import { api } from '../api';
import type { DataSource, Experiment, Verdict } from './types';
export function createLiveSource(onError: () => void): DataSource {
  const read = () =>
    api<{ experiments: Experiment[]; verdicts: Verdict[] }>('/api/app/experiments').catch(() => {
      onError();
      return { experiments: [], verdicts: [] };
    });
  return {
    id: 'supabase',
    async experiments() {
      const list = (await read()).experiments;
      const running = list.filter((e) => e.status === 'running');
      return running.length ? running : list.slice(0, 1);
    },
    async verdicts() {
      return (await read()).verdicts;
    },
  };
}
