'use client';

import { useId } from 'react';
import { useGo } from '../../../components/onboarding/go';
import { Mark } from '../../../components/onboarding/mark';
import { Icon } from '../../../components/icon';
import { Button } from '../../../components/ui';
import { copy } from '../../../lib/copy';
import { useProgress } from '../../../lib/progress/context';

/** The name screen, on paper: a first name to address them by. The email waits for the invitation. */
export function NameForm() {
  const go = useGo();
  const { progress, update } = useProgress();
  const id = useId();
  return (
    <form
      className="stack screen-name"
      onSubmit={(e) => {
        e.preventDefault();
        go('stack', { name: progress.name.trim() });
      }}
    >
      <div className="name-mark" aria-hidden="true">
        <Mark />
      </div>
      <h1>{copy.name.title}</h1>
      <div className="name-fields">
        <label htmlFor={id}>
          <span>{copy.name.label}</span>
          <input
            id={id}
            autoComplete="given-name"
            maxLength={80}
            value={progress.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder={copy.name.placeholder}
          />
        </label>
      </div>
      <div className="actions">
        <Button type="submit" className="btn-ink">
          {copy.common.continue}
          <Icon name="arrow" size={18} />
        </Button>
      </div>
    </form>
  );
}
