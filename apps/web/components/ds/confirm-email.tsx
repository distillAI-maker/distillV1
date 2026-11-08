'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { requestMagicLink } from '../../app/sign-in/actions';
import { copy } from '../../lib/copy';
import { useProgress } from '../../lib/progress/context';
import { track } from '../../lib/track';
import { Arrow, Mark } from './ui';

const t = copy.ritualTab;
const CONFIRMED_COOKIE = 'distill_confirmed';
/** Stays for this visit, so the line survives the page settling once the engine is ready. */
let confirmedThisVisit = false;

/** The inbox people use most, so "Open Gmail" is one tap away. Null for any other address. */
export function inboxFor(email: string | undefined): { name: string; url: string } | null {
  const domain = email?.split('@')[1]?.toLowerCase();
  if (!domain) return null;
  if (domain === 'gmail.com' || domain === 'googlemail.com') return { name: 'Gmail', url: 'https://mail.google.com/mail/u/0/#inbox' };
  if (/^(outlook|hotmail|live|msn)\./.test(domain)) return { name: 'Outlook', url: 'https://outlook.live.com/mail/0/' };
  if (/^(yahoo|ymail)\./.test(domain)) return { name: 'Yahoo Mail', url: 'https://mail.yahoo.com/' };
  if (domain === 'icloud.com' || domain === 'me.com' || domain === 'mac.com') return { name: 'iCloud Mail', url: 'https://www.icloud.com/mail' };
  return null;
}

/**
 * The step most apps have: confirm your email. Shown only while signed out and waiting on the link;
 * opening the link signs them in, and then this is never drawn. "Resend" really sends another one.
 */
export function ConfirmEmail({ email }: { email: string | undefined }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const inbox = inboxFor(email);

  async function resend() {
    if (!email) return;
    track('link_resent');
    setState('sending');
    const form = new FormData();
    form.set('email', email);
    const sent = await requestMagicLink({ status: 'idle', email: '' }, form).catch(() => null);
    setState(sent?.status === 'sent' ? 'sent' : 'failed');
  }

  return (
    <section className="ds-card rt-confirm" aria-label={t.confirmTitle}>
      <Mark size="sm" />
      <h2>{t.confirmTitle}</h2>
      {email ? (
        <p>
          {t.confirmSent} <strong>{email}</strong>. {t.confirmWhy}
        </p>
      ) : (
        <p>{t.confirmNoEmail}</p>
      )}
      <p className="rt-confirm-note">{t.confirmNote}</p>
      <div className="rt-confirm-actions">
        {inbox ? (
          <a className="ds-primary" href={inbox.url} target="_blank" rel="noopener noreferrer">
            {t.confirmOpen(inbox.name)}
            <Arrow />
          </a>
        ) : null}
        {email ? (
          <button
            type="button"
            className={inbox ? 'ds-link' : 'ds-primary'}
            disabled={state === 'sending' || state === 'sent'}
            onClick={() => void resend()}
          >
            {state === 'sent' ? t.confirmResent : state === 'failed' ? t.confirmFailed : t.confirmResend}
          </button>
        ) : null}
        <Link className="ds-link ds-link--quiet" href="/sign-in">
          {t.confirmChange}
        </Link>
      </div>
    </section>
  );
}

/**
 * Just back from the email link: says so once, and only after their progress really reached the
 * account. /auth/callback leaves a short-lived note for this in a cookie.
 */
export function EmailConfirmed() {
  const { ready, saveNow } = useProgress();
  const [show, setShow] = useState(confirmedThisVisit);
  useEffect(() => {
    if (!ready || !document.cookie.split('; ').includes(`${CONFIRMED_COOKIE}=1`)) return;
    document.cookie = `${CONFIRMED_COOKIE}=; Max-Age=0; path=/`;
    // Often a different browser from the one onboarding ran in (the mail app's), so it's counted
    // on its own rather than as the next step of the same device (docs/FUNNEL.md).
    track('email_confirmed');
    void saveNow()
      .then(() => {
        confirmedThisVisit = true;
        setShow(true);
      })
      .catch(() => undefined);
  }, [ready, saveNow]);
  if (!show) return null;
  return (
    <p className="rt-confirmed" role="status">
      {t.confirmed}
    </p>
  );
}
