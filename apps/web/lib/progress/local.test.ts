import { describe, expect, it } from 'vitest';
import { LocalProgressStore, localKey } from './local';
import { emptyProgress } from './types';

function memory() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  };
}

describe('LocalProgressStore', () => {
  it('returns null when nothing is saved', async () => {
    expect(await new LocalProgressStore(memory()).load()).toBeNull();
  });
  it('round-trips progress', async () => {
    const storage = memory();
    const store = new LocalProgressStore(storage);
    const p = { ...emptyProgress(), step: 'stack' as const, dataSource: 'demo' as const };
    await store.save(p);
    expect(await store.load()).toEqual(p);
    await store.clear();
    expect(await store.load()).toBeNull();
  });
  it('ignores corrupt or foreign data', async () => {
    const storage = memory();
    storage.setItem(localKey, '{not json');
    expect(await new LocalProgressStore(storage).load()).toBeNull();
    storage.setItem(localKey, JSON.stringify({ version: 2, step: 'connect' }));
    expect(await new LocalProgressStore(storage).load()).toBeNull();
  });
  it('survives a missing storage', async () => {
    const store = new LocalProgressStore(null);
    await store.save(emptyProgress());
    expect(await store.load()).toBeNull();
  });
});
