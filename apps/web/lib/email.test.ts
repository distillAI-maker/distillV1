import { describe, expect, it } from 'vitest';
import { checkEmail } from './email';

describe('checking an email before sending to it', () => {
  it('takes ordinary addresses, school and work ones included', () => {
    for (const e of ['maya@gmail.com', 'Maya.Lee+distill@Gmail.com', 'ml@stanford.edu', 'ish@company.co.uk', 'r@distill.ai', ' veer@me.com '])
      expect(checkEmail(e)).toEqual({ ok: true });
  });

  it('refuses what can’t be an address', () => {
    for (const e of ['maya', 'maya@', '@gmail.com', 'maya@gmail', 'maya@gmail.', 'maya @gmail.com', 'maya@gmail.c0m', 'maya@@gmail.com'])
      expect(checkEmail(e).ok).toBe(false);
  });

  it('offers the likely address for a slip', () => {
    expect(checkEmail('maya@gmial.com')).toEqual({ ok: true, suggestion: 'maya@gmail.com' });
    expect(checkEmail('maya@gmail.con')).toEqual({ ok: true, suggestion: 'maya@gmail.com' });
    expect(checkEmail('maya@hotmial.com')).toEqual({ ok: true, suggestion: 'maya@hotmail.com' });
    expect(checkEmail('maya@yahooo.com')).toEqual({ ok: true, suggestion: 'maya@yahoo.com' });
    expect(checkEmail('maya@school.cmo')).toEqual({ ok: true, suggestion: 'maya@school.com' });
  });

  it('leaves real addresses that only look like slips alone', () => {
    for (const e of ['maya@ymail.com', 'maya@mail.com', 'maya@msn.com', 'maya@hotmail.co.uk']) expect(checkEmail(e)).toEqual({ ok: true });
  });
});
