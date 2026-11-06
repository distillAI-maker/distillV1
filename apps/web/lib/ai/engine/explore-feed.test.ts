import { describe, expect, it, vi } from 'vitest';
import { personFromProgress } from '@distill/engine/ritual';
import { findEvents, searchedHosts } from './explore-feed';
import type { ClaudeClient } from './call';

const person = personFromProgress(
  { name: 'Maya', lifeText: '', goals: [], items: [], dayOne: { yours: [] }, asks: [] },
  { personId: 'u', timeZone: 'UTC', today: '2026-11-05' },
);
const results = (...urls: string[]) => ({
  type: 'web_search_tool_result',
  content: urls.map((url) => ({ type: 'web_search_result', url, title: 't', encrypted_content: 'abc' })),
});
const said = (events: unknown[]) => ({ type: 'text', text: JSON.stringify({ events }) });
const event = (over: Record<string, unknown> = {}) => ({
  thread: 'running',
  kind: 'race',
  title: 'Oakland Half',
  date: '2027-03-22',
  when: null,
  where: 'Oakland',
  url: 'https://www.oaklandmarathon.com/half',
  why: 'Your Sunday long run, with a finish line.',
  ...over,
});
const clientWith = (...turns: unknown[]) => {
  const create = vi.fn();
  for (const t of turns) create.mockResolvedValueOnce(t);
  return { client: { messages: { create }, beta: { messages: { create } } } as unknown as ClaudeClient, create };
};
const ask = { person, threads: [{ id: 'running', name: 'Running', from: [] }], region: 'Oakland', today: '2026-11-05', skip: [], liked: [], banned: ['biohack'] };

describe('finding real things near them', () => {
  it('asks for web search, and keeps an event with a page the search really returned', async () => {
    const { client, create } = clientWith({
      content: [results('https://oaklandmarathon.com/half'), said([event()])],
      stop_reason: 'end_turn',
      usage: { input_tokens: 1000, output_tokens: 100, server_tool_use: { web_search_requests: 2 } },
    });
    const r = await findEvents(client, ask);
    expect(create.mock.calls[0]![0].tools[0]).toEqual({ type: 'web_search_20260209', name: 'web_search', max_uses: 5 });
    expect(r.from).toBe('claude');
    expect(r.events.map((e) => e.title)).toEqual(['Oakland Half']);
    expect(r.events[0]!.source).toBe('oaklandmarathon.com');
    expect(r.searches).toBe(2);
    expect(r.usage!.costUsd).toBeGreaterThan(0.02);
  });
  it('drops anything without a page behind it, a date that has passed, or no date at all', async () => {
    const { client } = clientWith({
      content: [
        results('https://real.example/a'),
        said([
          event({ title: 'Made up', url: 'https://invented.example/x' }),
          event({ title: 'Last year', url: 'https://real.example/a', date: '2025-01-01' }),
          event({ title: 'Too far', url: 'https://real.example/a', date: '2028-01-01' }),
          event({ title: 'No date', url: 'https://real.example/a', date: null, when: null }),
          event({ title: 'Other thread', url: 'https://real.example/a', thread: 'golf' }),
          event({ title: 'Banned', url: 'https://real.example/a', why: 'Biohack your mornings' }),
          event({ title: 'Sunday club', url: 'https://real.example/a', date: null, when: 'Sundays at 8', kind: 'group' }),
        ]),
      ],
      stop_reason: 'end_turn',
    });
    const r = await findEvents(client, ask);
    expect(r.events.map((e) => e.title)).toEqual(['Sunday club']);
    expect(r.dropped).toHaveLength(6);
  });
  it('does not count an address Claude only wrote in its own words', () => {
    expect(searchedHosts([{ type: 'text', text: 'see https://invented.example/x' }]).size).toBe(0);
    expect([...searchedHosts([{ type: 'text', text: '', citations: [{ url: 'https://cited.example/a' }] }])]).toEqual(['cited.example']);
  });
  it('carries on when the search pauses', async () => {
    const paused = { content: [results('https://oaklandmarathon.com/half')], stop_reason: 'pause_turn' };
    const { client, create } = clientWith(paused, { content: [said([event()])], stop_reason: 'end_turn' });
    const r = await findEvents(client, ask);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1]![0].messages.at(-1).role).toBe('assistant');
    expect(r.events).toHaveLength(1);
  });
  it('fails quietly, leaving the evergreen next steps, on an error, an unreadable answer or no client', async () => {
    const create = vi.fn().mockRejectedValue(new Error('down'));
    const down = { messages: { create }, beta: { messages: { create } } } as unknown as ClaudeClient;
    expect((await findEvents(down, ask)).from).toBe('failed');
    const { client } = clientWith({ content: [{ type: 'text', text: 'Sorry, nothing.' }], stop_reason: 'end_turn' });
    expect((await findEvents(client, ask)).from).toBe('failed');
    expect((await findEvents(null, ask)).from).toBe('off');
  });
});
