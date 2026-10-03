'use client';

import { useActionState } from 'react';
import { copy } from '../../lib/copy';
import { Button, Field } from '../../components/ui';
import { requestMagicLink } from './actions';
import type { SignInState } from './actions';

const initial: SignInState = { status: 'idle', email: '' };

export function SignInForm({ expired }: { expired?: boolean }) {
  const [state, action, pending] = useActionState(requestMagicLink, initial);

  if (state.status === 'sent') {
    return (
      <form action={action} className="stack" aria-live="polite">
        <h1>{copy.signIn.sentTitle}</h1>
        <p className="lede">{copy.signIn.sentLine}</p>
        <input type="hidden" name="email" value={state.email} />
        <div className="actions-row">
          <Button type="submit" variant="ghost" busy={pending}>
            {copy.signIn.sendAgain}
          </Button>
          <Button
            variant="link"
            onClick={() => {
              window.location.assign('/sign-in');
            }}
          >
            {copy.signIn.differentAddress}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form action={action} className="stack">
      <h1>{expired ? copy.signIn.expiredTitle : copy.signIn.title}</h1>
      <p className="lede">{copy.signIn.line}</p>
      <Field
        label={copy.signIn.emailLabel}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        defaultValue={state.email}
        error={state.status === 'error' ? state.message : undefined}
      />
      <div className="actions">
        <Button type="submit" busy={pending}>
          {expired ? copy.signIn.sendNew : copy.signIn.send}
        </Button>
      </div>
    </form>
  );
}
