'use client';

import { useActionState, useId, useState, type FormEvent } from 'react';
import { Arrow, Mark } from '../../components/ds/ui';
import { copy } from '../../lib/copy';
import { checkEmail } from '../../lib/email';
import { useProgress } from '../../lib/progress/context';
import { resumePath } from '../../lib/steps';
import { requestMagicLink } from './actions';
import type { SignInState } from './actions';

const initial: SignInState = { status: 'idle', email: '' };

export function SignInForm({ expired }: { expired?: boolean }) {
  const [state, action, pending] = useActionState(requestMagicLink, initial);
  const id = useId();
  const [email, setEmail] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<{ for: string; email: string } | null>(null);

  /** Nothing is sent to an address that can't exist; a likely slip is asked about once. */
  function check(e: FormEvent<HTMLFormElement>) {
    const typed = email.trim();
    const c = checkEmail(typed);
    if (!c.ok) {
      e.preventDefault();
      setProblem(copy.signIn.errorInvalid);
      return;
    }
    if (c.suggestion && suggestion?.for !== typed) {
      e.preventDefault();
      setSuggestion({ for: typed, email: c.suggestion });
      return;
    }
    setProblem(null);
    setSuggestion(null);
  }

  if (state.status === 'sent') {
    return (
      <form action={action} className="ds-card si-card" aria-live="polite">
        <Mark size="sm" />
        <h1>{copy.signIn.sentTitle}</h1>
        <p>{copy.signIn.sentLine}</p>
        <input type="hidden" name="email" value={state.email} />
        <button type="submit" className="ds-secondary" disabled={pending} aria-busy={pending || undefined}>
          {copy.signIn.sendAgain}
        </button>
        <div className="ob-other">
          <button type="button" className="ds-link" onClick={() => window.location.assign('/sign-in')}>
            {copy.signIn.differentAddress}
          </button>
          <CarryOn />
        </div>
      </form>
    );
  }

  return (
    <form action={action} className="ds-card si-card" onSubmit={check} noValidate>
      <h1>{expired ? copy.signIn.expiredTitle : copy.signIn.title}</h1>
      <p>{copy.signIn.line}</p>
      <label className="sr-only" htmlFor={id}>
        {copy.signIn.emailLabel}
      </label>
      <input
        id={id}
        className="ds-field"
        style={{ marginBottom: 10, background: '#fff' }}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder={copy.signIn.emailLabel}
        required
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setProblem(null);
        }}
        aria-invalid={problem || state.status === 'error' ? true : undefined}
      />
      {problem || state.status === 'error' ? (
        <p className="ds-error" role="alert" style={{ marginBottom: 10 }}>
          {problem ?? state.message}
        </p>
      ) : null}
      {suggestion ? (
        <p className="ds-error" role="alert" style={{ marginBottom: 10, color: 'var(--ink)' }}>
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
      <button type="submit" className="ds-primary" disabled={pending} aria-busy={pending || undefined}>
        {expired ? copy.signIn.sendNew : copy.signIn.send}
        <Arrow />
      </button>
      <div className="ob-other">
        <CarryOn />
      </div>
    </form>
  );
}

/** Signing in is optional: everything also runs on this phone. This goes back to where they left off. */
function CarryOn() {
  const { ready, progress } = useProgress();
  const started = progress.items.length > 0 || (progress.step !== 'stack' && progress.step !== 'name');
  return (
    <a className="ds-link ds-link--quiet" href={ready && started ? resumePath(progress.step) : '/'}>
      {copy.signIn.onThisPhone}
    </a>
  );
}
