'use client';

import { useEffect, useId, useState } from 'react';
import { useGo } from '../../../components/onboarding/go';
import { RitualToken } from '../../../components/ds/ritual-token';
import { useRefreshOnReturn } from '../../../components/ds/use-refresh-on-return';
import { Arrow, Mark } from '../../../components/ds/ui';
import { copy } from '../../../lib/copy';
import { checkEmail } from '../../../lib/email';
import { useRouted } from '../../../lib/data/use-routed';
import { nextStep } from '../../../lib/steps';
import { useProgress } from '../../../lib/progress/context';
import { track } from '../../../lib/track';
import { joinWaitlist } from '../../../lib/waitlist';
import { requestMagicLink } from '../../sign-in/actions';


type Link = { state: 'idle' } | { state: 'sent'; email: string } | { state: 'failed' };

/**
 * The invitation: the brand board's Founding Member card, with their name on it, and three lines. The email asked here
 * always joins the Founding 100 waitlist (lib/waitlist.ts); with accounts switched on, joining also
 * sends a sign-in link that keeps what they added. Then their Ritual (or the wearable, once that's on).
 */
export function Invitation({ accounts = false }: { accounts?: boolean }) {
  const go = useGo();
  const { progress, update, saveNow, store } = useProgress();
  useRefreshOnReturn(accounts && progress.member && store.id === 'local');
  const { routed, summary } = useRouted();
  const [email, setEmail] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<Link>({ state: 'idle' });
  /** "Did you mean …?": asked once for the address they typed. */
  const [suggestion, setSuggestion] = useState<{ for: string; email: string } | null>(null);
  /** "Wrong email? Change it": the form again, after joining. */
  const [changing, setChanging] = useState(false);
  const emailId = useId();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [progress.member, changing]);
  if (!routed || !summary)
    return (
      <div className="ob-content" aria-busy="true">
        <div className="ob-wait">
          <i />
          <i />
        </div>
      </div>
    );

  const member = progress.member;

  async function join() {
    setProblem(null);
    const typed = email.trim();
    const check = checkEmail(typed);
    if (!check.ok) return setProblem(copy.invitation.emailError);
    // A likely slip ("gmial.com") is asked about once; joining again sends to what they typed.
    if (check.suggestion && suggestion?.for !== typed) return setSuggestion({ for: typed, email: check.suggestion });
    setSuggestion(null);
    setChanging(false);
    track('joined', { email: true });
    setBusy(true);
    // On the list either way; a failed save never stops anyone joining.
    await joinWaitlist(email);
    if (!accounts) {
      setBusy(false);
      return update({ member: true });
    }
    const next = { ...progress, member: true, joinedEmail: typed.toLowerCase(), updatedAt: new Date().toISOString() };
    try {
      // Saved on this device first, so the sign-in link carries it into the account.
      await saveNow(next);
      update({ member: true, joinedEmail: typed.toLowerCase() });
      // And on the server, so the link keeps it even if it opens in another browser. Never waited on for long.
      await fetch('/api/keep', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: typed, progress: next }),
        signal: AbortSignal.timeout(8000),
      }).catch(() => undefined);
      const form = new FormData();
      form.set('email', email.trim());
      const sent = await requestMagicLink({ status: 'idle', email: '' }, form);
      setLink(sent.status === 'sent' ? { state: 'sent', email: sent.email } : { state: 'failed' });
    } catch {
      update({ member: true });
      setLink({ state: 'failed' });
    } finally {
      setBusy(false);
    }
  }

  /** On to the wearable when it can connect; until then, straight into their Ritual. */
  async function finish() {
    const next = nextStep('invitation');
    if (next !== 'done') return go(next);
    track('no_wearable');
    setBusy(true);
    // Saved before the app opens, so it opens on their Ritual and not back here.
    await saveNow({ ...progress, step: 'done', updatedAt: new Date().toISOString() }).catch(() => undefined);
    go('done');
  }

  const name = progress.name.trim();

  if (member && !changing)
    return (
      <section className="jn-welcome" aria-live="polite">
        <RitualToken />
        <Mark />
        <h1>{name ? copy.invitation.joinedNamed(name) : copy.invitation.joined}</h1>
        {/* Without a name the heading already says it. */}
        {name ? <h2>{copy.invitation.joinedLine}</h2> : null}
        {link.state === 'sent' ? (
          <div className="jn-email">
            <h3>{copy.invitation.emailTitle}</h3>
            <p className="jn-email-line">{copy.invitation.emailLine}</p>
            <p className="jn-email-note">{copy.invitation.linkSent(link.email)}</p>
          </div>
        ) : link.state === 'failed' ? (
          <p>{copy.invitation.linkFailed}</p>
        ) : null}
        <button type="button" className="ds-primary" onClick={() => void finish()} disabled={busy}>
          {link.state === 'sent' ? copy.invitation.connectDemo : copy.invitation.connect}
          <Arrow />
        </button>
        {accounts ? (
          <div className="ob-other">
            <button
              type="button"
              className="ds-link ds-link--quiet"
              onClick={() => {
                setEmail(link.state === 'sent' ? link.email : '');
                setChanging(true);
              }}
            >
              {copy.invitation.changeEmail}
            </button>
          </div>
        ) : null}
      </section>
    );

  return (
    <div className="ob-content">
      <RitualToken />
      <section className="jn-card" aria-hidden="true">
        <div className="jn-card-top">
          <span>Distill · 2026</span>
          <span>{copy.invitation.cardKicker}</span>
        </div>
        <Mark light />
        <p className="jn-card-kicker">{copy.invitation.cardTitle}</p>
        <h2>{name || copy.invitation.cardNameFallback}</h2>
        <small>{copy.invitation.cardLine}</small>
      </section>
      <header className="jn-heading">
        <h1>{copy.invitation.title}</h1>
        <p>{copy.invitation.line}</p>
      </header>

      <section className="jn-get">
        <h2>{copy.invitation.includesTitle}</h2>
        <ul>
          {copy.invitation.includes.map((b) => (
            <li key={b.label}>
              <strong>{b.label}</strong>
              <p>{b.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <form
        className="jn-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void join();
        }}
      >
        <p>{copy.invitation.freeLine}</p>
        <label className="sr-only" htmlFor={emailId}>
          {copy.invitation.emailLabel}
        </label>
        <input
          id={emailId}
          className="ds-field"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={copy.invitation.emailPlaceholder}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setProblem(null);
          }}
          aria-invalid={problem ? true : undefined}
        />
        {problem ? (
          <p className="ds-error" role="alert">
            {problem}
          </p>
        ) : null}
        {suggestion ? (
          <p className="ds-error" role="alert" style={{ color: 'var(--ink)' }}>
            {copy.invitation.didYouMean}{' '}
            <button
              type="button"
              className="ds-link"
              style={{ minHeight: 0, padding: 0 }}
              onClick={() => {
                setEmail(suggestion.email);
                setSuggestion(null);
              }}
            >
              {suggestion.email}
            </button>
            ?
          </p>
        ) : null}
        <button type="submit" className="ds-primary" disabled={busy} aria-busy={busy || undefined}>
          {copy.invitation.begin}
          <Arrow />
        </button>
      </form>
    </div>
  );
}
