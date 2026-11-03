'use client';

import { copy } from '../../lib/copy';
import { Mark } from './ui';

/**
 * The move-in: after "Make it mine", the Ritual they accepted travels with them as a small token
 * through joining and the wearable step, then settles into the Ritual tab at the end.
 */
export function RitualToken({ arriving, settling }: { arriving?: boolean; settling?: boolean }) {
  return (
    <div
      className={`ds-token${arriving ? ' is-arriving' : ''}${settling ? ' is-settling' : ''}`}
      aria-hidden="true"
    >
      <Mark size="xs" light />
      <span>{copy.reveal.token}</span>
    </div>
  );
}
