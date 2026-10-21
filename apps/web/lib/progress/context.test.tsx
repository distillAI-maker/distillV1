// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProgressProvider, useProgress } from './context';
import { localKey } from './local';
import { emptyProgress, type Progress, type ProgressStore } from './types';

const onboarded: Progress = {
  ...emptyProgress(),
  step: 'invitation',
  name: 'Ishan',
  lifeText: 'Coffee before anyone is up.',
  items: [{ id: 'a', itemKey: 'magnesium-any-form', monthlyCost: 12, answers: {}, chips: {}, unknown: [], status: 'listed', notes: [], position: 0 }],
};
function account(load: () => Promise<Progress | null>) {
  const save = vi.fn(async () => {});
  const store: ProgressStore = { id: 'supabase', load, save, clear: async () => {} };
  return { store, save };
}
function Name() {
  const { ready, progress } = useProgress();
  return <p>{ready ? `name:${progress.name || 'none'}` : 'loading'}</p>;
}
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('first sign-in from the email link', () => {
  it('carries the onboarding done on this device into the new account, and saves it there', async () => {
    localStorage.setItem(localKey, JSON.stringify(onboarded));
    const { store, save } = account(async () => null);
    render(<ProgressProvider store={store}><Name /></ProgressProvider>);
    expect(await screen.findByText('name:Ishan')).toBeTruthy();
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0]![0]).toMatchObject({ name: 'Ishan', items: [{ id: 'a' }] });
  });
  it('an account that already has progress keeps its own, never the device’s', async () => {
    localStorage.setItem(localKey, JSON.stringify(onboarded));
    const { store, save } = account(async () => ({ ...onboarded, name: 'Saved' }));
    render(<ProgressProvider store={store}><Name /></ProgressProvider>);
    expect(await screen.findByText('name:Saved')).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
  });
  it('when the server can’t load (no database address), it says so and overwrites nothing; the device copy survives', async () => {
    localStorage.setItem(localKey, JSON.stringify(onboarded));
    const { store, save } = account(async () => {
      throw new Error('database_not_configured');
    });
    render(<ProgressProvider store={store}><Name /></ProgressProvider>);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(localKey)!).name).toBe('Ishan');
  });
  it('opened on another device (nothing saved there), it starts empty rather than inventing progress', async () => {
    const { store, save } = account(async () => null);
    render(<ProgressProvider store={store}><Name /></ProgressProvider>);
    expect(await screen.findByText('name:none')).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
  });
});
