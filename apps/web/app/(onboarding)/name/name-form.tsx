'use client';

import { useId } from 'react';
import { Arrow, Disclaimer, Mark } from '../../../components/ds/ui';
import { useGo } from '../../../components/onboarding/go';
import { copy } from '../../../lib/copy';
import { useProgress } from '../../../lib/progress/context';
import { track } from '../../../lib/track';

/** The name: a first name to address them by. Not a numbered step. The email waits for the invitation. */
export function NameForm() {
  const go = useGo();
  const { progress, update } = useProgress();
  const id = useId();
  return (
    <form
      className="ob-main"
      onSubmit={(e) => {
        e.preventDefault();
        track('started');
        go('stack', { name: progress.name.trim() });
      }}
    >
      <div className="ob-content">
        <header className="ob-heading ob-heading--name">
          <Mark />
          <h1>{copy.name.title}</h1>
        </header>
        <label className="sr-only" htmlFor={id}>
          {copy.name.label}
        </label>
        <input
          id={id}
          className="ds-field ds-field--serif"
          autoComplete="given-name"
          maxLength={80}
          value={progress.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder={copy.name.placeholder}
        />
        <Disclaimer />
      </div>
      <div className="ob-sticky">
        <button type="submit" className="ds-primary">
          {copy.common.continue}
          <Arrow />
        </button>
      </div>
    </form>
  );
}
