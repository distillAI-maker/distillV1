/**
 * Is this an email we can send to, before we send anything? Stricter than "something@something.x":
 * the ending has to be real letters (".com", ".edu", ".co.uk"). A likely slip on a big provider
 * ("gmial.com", "gmail.con", "hotmial.com") comes back as a suggestion to tap: asked once, never
 * forced, since a real address can look like a slip.
 */

export interface EmailCheck {
  /** Shaped like an address we can send to. */
  readonly ok: boolean;
  /** The address with a likely slip fixed, when there is one. */
  readonly suggestion?: string;
}

/** Real domains that sit one letter from a big provider. */
const REAL = new Set(['mail.com', 'ymail.com', 'gmx.com', 'msn.com', 'mac.com', 'email.com', 'aim.com', 'yahoo.co.uk', 'hotmail.co.uk', 'outlook.co.uk']);

const PROVIDERS = ['gmail.com', 'googlemail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'me.com', 'live.com', 'aol.com', 'proton.me', 'protonmail.com'];
/** Endings people mistype for ".com". */
const NOT_COM = new Set(['con', 'cmo', 'cpm', 'comm', 'om', 'vom', 'xom', 'cim', 'co m', 'coom', 'ocm']);

const SHAPE = /^[^\s@]+@([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,24}$/i;

/** How many single edits apart two short strings are (Levenshtein). */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const here = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = here;
    }
  }
  return row[b.length]!;
}

export function checkEmail(raw: string): EmailCheck {
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf('@');
  if (at < 1) return { ok: false };
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const parts = domain.split('.');
  const tld = parts[parts.length - 1] ?? '';
  const name = parts.slice(0, -1).join('.');

  const ok = SHAPE.test(email);
  // A slip on a big provider, or ".con" for ".com": offered back fixed.
  if (!PROVIDERS.includes(domain) && !REAL.has(domain)) {
    const near = PROVIDERS.find((p) => distance(domain, p) <= 2 && Math.abs(domain.length - p.length) <= 2);
    if (near) return { ok, suggestion: `${local}@${near}` };
  }
  if (NOT_COM.has(tld) && name) return { ok, suggestion: `${local}@${name}.com` };
  return { ok };
}
