// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProgressProvider } from '../../../lib/progress/context';
import { emptyProgress, type Progress, type ProgressStore } from '../../../lib/progress/types';
import { Invitation } from './invitation';

const send = vi.hoisted(() => vi.fn(async (_: unknown, form?: FormData) => ({ status: 'sent' as const, email: String(form?.get('email')) })));
vi.mock('../../sign-in/actions', () => ({ requestMagicLink: send }));
vi.mock('../../../lib/waitlist', () => ({ joinWaitlist: vi.fn(async () => true) }));
vi.mock('../../../lib/track', () => ({ track: vi.fn() }));
vi.mock('../../../lib/data/use-routed', () => ({ useRouted: () => ({ routed: { items: [] }, summary: { count: 0, monthlyTotal: 0 }, failed: false, retry: () => {} }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
window.scrollTo = vi.fn() as never;

function mount() {
  const saved: Progress[] = [];
  const store: ProgressStore = { id: 'local', load: async () => ({ ...emptyProgress(), name: 'Maya', step: 'invitation' }), save: async (p) => void saved.push(p), clear: async () => {} };
  render(
    <ProgressProvider store={store}>
      <Invitation accounts />
    </ProgressProvider>,
  );
  return saved;
}
const type = (value: string) => fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value } });
const join = () => act(async () => void fireEvent.click(screen.getByRole('button', { name: /Join free/ })));

describe('Join the Founding 100', () => {
  afterEach(cleanup);
  beforeEach(() => send.mockClear());

  it('says an email is not valid before sending anything', async () => {
    mount();
    await screen.findByRole('heading', { name: 'Join the Founding 100.' });
    type('maya@gmail');
    await join();
    expect(screen.getByRole('alert').textContent).toBe('That email is not valid. Try again.');
    expect(send).not.toHaveBeenCalled();
  });

  it('asks about a likely slip once, and a tap fixes it', async () => {
    const saved = mount();
    await screen.findByRole('heading', { name: 'Join the Founding 100.' });
    type('maya@gmial.com');
    await join();
    expect(send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'maya@gmail.com' }));
    await join();
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(String((send.mock.calls[0]![1] as FormData).get('email'))).toBe('maya@gmail.com');
    expect(saved.some((p) => p.joinedEmail === 'maya@gmail.com')).toBe(true);
  });

  it('lets them change a wrong email after joining', async () => {
    mount();
    await screen.findByRole('heading', { name: 'Join the Founding 100.' });
    type('maya@school.edu');
    await join();
    fireEvent.click(await screen.findByRole('button', { name: 'Wrong email? Change it' }));
    type('maya@stanford.edu');
    await join();
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(String((send.mock.calls[1]![1] as FormData).get('email'))).toBe('maya@stanford.edu');
    expect(await screen.findByText(/We sent a link to maya@stanford.edu/)).toBeTruthy();
  });
});
