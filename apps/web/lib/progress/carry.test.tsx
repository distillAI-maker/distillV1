// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProgressProvider, useProgress } from './context';
import { localKey } from './local';
import { emptyProgress, type ProgressStore } from './types';

function Show() {
  const { ready, progress } = useProgress();
  return <p>{ready ? `name:${progress.name}` : 'loading'}</p>;
}
const empty: ProgressStore = { id: 'supabase', load: async () => null, save: async () => {}, clear: async () => {} };

describe('the first sign-in carries onboarding from this browser', () => {
  afterEach(cleanup);
  beforeEach(() => localStorage.clear());

  it('into the account that joined with that email', async () => {
    localStorage.setItem(localKey, JSON.stringify({ ...emptyProgress(), name: 'Maya', joinedEmail: 'maya@gmail.com' }));
    render(
      <ProgressProvider store={empty} userEmail="Maya@Gmail.com">
        <Show />
      </ProgressProvider>,
    );
    expect(await screen.findByText('name:Maya')).toBeTruthy();
  });

  it('never into a different account', async () => {
    localStorage.setItem(localKey, JSON.stringify({ ...emptyProgress(), name: 'Old test', joinedEmail: 'someone@else.com' }));
    render(
      <ProgressProvider store={empty} userEmail="maya@gmail.com">
        <Show />
      </ProgressProvider>,
    );
    expect(await screen.findByText('name:')).toBeTruthy();
  });
});

describe('the copy the server kept when they joined', () => {
  afterEach(cleanup);
  beforeEach(() => localStorage.clear());
  const kept = { ...emptyProgress(), name: 'From server', joinedEmail: 'maya@gmail.com', fromJoin: true, updatedAt: '2026-11-05T10:00:00.000Z' };

  it('is what they find when the link opens in another browser, and gets saved as theirs', async () => {
    const saved: unknown[] = [];
    const store: ProgressStore = { id: 'supabase', load: async () => kept, save: async (p) => void saved.push(p), clear: async () => {} };
    render(
      <ProgressProvider store={store} userEmail="maya@gmail.com">
        <Show />
      </ProgressProvider>,
    );
    expect(await screen.findByText('name:From server')).toBeTruthy();
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).not.toHaveProperty('fromJoin');
  });

  it('gives way to this browser when they kept going in the demo after joining', async () => {
    localStorage.setItem(localKey, JSON.stringify({ ...emptyProgress(), name: 'Newer here', joinedEmail: 'maya@gmail.com', updatedAt: '2026-11-05T11:00:00.000Z' }));
    const store: ProgressStore = { id: 'supabase', load: async () => kept, save: async () => {}, clear: async () => {} };
    render(
      <ProgressProvider store={store} userEmail="maya@gmail.com">
        <Show />
      </ProgressProvider>,
    );
    expect(await screen.findByText('name:Newer here')).toBeTruthy();
  });
});
