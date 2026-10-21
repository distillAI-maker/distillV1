'use client';

import Link from 'next/link';
import { useEngine } from '../../../lib/engine/context';
import { copy } from '../../../lib/copy';
import { useProgress } from '../../../lib/progress/context';
import { RitualToday } from './ritual-today';
import { Today } from './today';
import s from './today.module.css';

/** Signed in, Today is today's Ritual. Signed out, it is still the reading, with the Ritual one tap away. */
export function TodayScreen() {
  const { ready } = useProgress();
  const { on } = useEngine();
  if (ready && on) return <RitualToday />;
  return (
    <>
      <Today />
      {ready ? (
        <p className={s.previewLink}>
          <Link href="/today/preview">{copy.days.previewLink}</Link>
        </p>
      ) : null}
    </>
  );
}
