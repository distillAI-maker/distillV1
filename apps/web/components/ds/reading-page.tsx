'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { copy } from '../../lib/copy';
import { Brand } from './ui';

/**
 * A plain page to read (privacy, help), in the app's column. Back returns to wherever they came from
 * in the app (Settings), or to the start when they arrived from outside (the App Store listing).
 */
export function ReadingPage({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <div className="ds">
      <div className="ds-col">
        <main className="rd">
          <div className="rd-top">
            <button
              type="button"
              className="ob-back"
              onClick={() => (window.history.length > 1 ? router.back() : router.push('/'))}
            >
              {copy.common.back}
            </button>
            <Brand size="sm" />
          </div>
          <h1>{title}</h1>
          {updated ? <p className="rd-updated">{updated}</p> : null}
          {children}
        </main>
      </div>
    </div>
  );
}
