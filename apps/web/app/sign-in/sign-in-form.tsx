'use client';

import { useActionState, useId } from 'react';
import { Arrow, Mark } from '../../components/ds/ui';
import { copy } from '../../lib/copy';
import { requestMagicLink } from './actions';
import type { SignInState } from './actions';

const initial: SignInState = { status: 'idle', email: '' };

export function SignInForm({ expired }: { expired?: boolean }) {
  const [state, action, pending] = useActionState(requestMagicLink, initial);
  const id = useId();

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
    <form action={action} className="ds-card si-card">
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
        defaultValue={state.email}
        aria-invalid={state.status === 'error' || undefined}
      />
      {state.status === 'error' ? (
        <p className="ds-error" role="alert" style={{ marginBottom: 10 }}>
          {state.message}
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

/** Signing in is optional: everything also runs on this device, and the opener resumes it. */
function CarryOn() {
  return (
    <a className="ds-link ds-link--quiet" href="/">
      {copy.signIn.onThisPhone}
    </a>
  );
}
