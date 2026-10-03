import { expect, it, vi } from 'vitest';
import { emptyMetrics } from '@distill/providers';
import { createDemoHandler } from './demo.js';
import { createHandler } from './handler.js';

const users = [1, 2, 3].map((n) => ({
  synthetic: true,
  userId: `60000000-0000-4000-8000-00000000000${n}`,
  name: `Demo ${n}`,
  asOf: '2026-10-03',
  from: '2026-04-04',
  to: '2026-10-04',
  inventory: [],
  answers: {},
  audit: {},
  workouts: [],
  tags: [],
  experiment: {},
  nights: [
    {
      ...emptyMetrics,
      sleepDate: '2026-10-03',
      source: 'synthetic',
      sourceId: 'demo',
      rawPayloadId: 'raw',
      deviceModel: null,
      hrvMethod: null,
      sleepStart: null,
      sleepEnd: null,
    },
  ],
}));
const request = (path: string, method = 'GET') => new Request(`http://app.test${path}`, { method });
it('isolates known read-only synthetic identities and never creates the live service', async () => {
  const service = vi.fn(() => {
    throw new Error('Live service should not load');
  });
  const demo = createDemoHandler({ enabled: () => true, load: async () => users });
  const handle = createHandler(service, () => {}, demo);
  const list = await handle(request('/api/demo/users'));
  expect(list.status).toBe(200);
  expect((await list.json()).users).toHaveLength(3);
  const detail = await handle(request(`/api/demo/users/${users[0]!.userId}`));
  expect((await detail.json()).nights[0].source).toBe('synthetic');
  expect((await handle(request('/api/demo/users/real-user'))).status).toBe(404);
  expect((await handle(request('/api/demo/users', 'POST'))).status).toBe(405);
  expect(service).not.toHaveBeenCalled();
});
it('keeps demo access disabled by default, reports unseeded fixtures, and rejects real-data fixtures', async () => {
  const load = vi.fn(async () => users);
  const disabled = createDemoHandler({ enabled: () => false, load });
  expect((await disabled(request('/api/demo/users'))).status).toBe(404);
  expect(load).not.toHaveBeenCalled();
  const unseeded = createDemoHandler({
    enabled: () => true,
    load: async () => {
      throw new Error('missing');
    },
  });
  expect((await unseeded(request('/api/demo/users'))).status).toBe(503);
  const corrupt = structuredClone(users);
  corrupt[0]!.nights[0]!.source = 'oura';
  const invalid = createDemoHandler({ enabled: () => true, load: async () => corrupt });
  expect((await invalid(request('/api/demo/users'))).status).toBe(503);
});
