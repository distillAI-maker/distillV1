// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProgressProvider } from '../../../lib/progress/context';
import { LocalProgressStore } from '../../../lib/progress/local';
import { emptyProgress } from '../../../lib/progress/types';
import { SettingsTab } from './settings-tab';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, back: vi.fn() }), usePathname: () => '/settings' }));
vi.mock('./actions', () => ({ deleteEverything: vi.fn(), signOut: vi.fn() }));

function memory() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

describe('Settings', () => {
  afterEach(cleanup);
  it('shows gentle messages as coming soon, toggles less motion, exports, and deletes everything', async () => {
    const store = new LocalProgressStore(memory());
    await store.save({ ...emptyProgress(), name: 'Maya', step: 'done', dataSource: 'demo', connectedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    const localSet = vi.spyOn(Storage.prototype, 'setItem');
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const onDelete = vi.fn(async () => ({ status: 'nothing' as const }));
    render(
      <ProgressProvider store={store}>
        <SettingsTab email={null} onDelete={onDelete} />
      </ProgressProvider>,
    );
    expect(await screen.findByText(/Demo data/)).toBeTruthy();
    expect(screen.getByText('Maya')).toBeTruthy();
    expect(screen.getByText('Coming soon')).toBeTruthy();

    const sw = screen.getByRole('switch', { name: /Less motion/ });
    fireEvent.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('true');
    expect(document.documentElement.dataset.motion).toBe('reduce');
    expect(localSet).toHaveBeenCalledWith('distill.motion', 'reduce');

    fireEvent.click(screen.getByRole('button', { name: /Your data/ }));
    expect(click).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete everything' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete everything?' });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete everything' }));
    });
    expect(onDelete).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/');
    await waitFor(async () => expect(await store.load()).toBeNull());
    click.mockRestore();
    localSet.mockRestore();
  });
});
