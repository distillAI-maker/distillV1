// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
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
