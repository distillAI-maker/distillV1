import { describe, expect, it } from 'vitest';
import { isTeam } from './team';

const confirmed = '2026-11-07T10:00:00Z';

describe('who sees the funnel page', () => {
  it('lets in a confirmed address on the list, whatever its case and spacing', () => {
    expect(isTeam({ email: 'Veer@Example.com', email_confirmed_at: confirmed }, ' rohan@example.com, veer@example.com ')).toBe(true);
  });

  it('fails closed: no list, not on it, unconfirmed, or no one signed in', () => {
    expect(isTeam({ email: 'veer@example.com', email_confirmed_at: confirmed }, undefined)).toBe(false);
    expect(isTeam({ email: 'veer@example.com', email_confirmed_at: confirmed }, '')).toBe(false);
    expect(isTeam({ email: 'someone@example.com', email_confirmed_at: confirmed }, 'veer@example.com')).toBe(false);
    expect(isTeam({ email: 'veer@example.com', email_confirmed_at: null }, 'veer@example.com')).toBe(false);
    expect(isTeam(null, 'veer@example.com')).toBe(false);
    expect(isTeam({ email: 'veer@example.com.evil.test', email_confirmed_at: confirmed }, 'veer@example.com')).toBe(false);
  });
});
