import type { ReactNode } from 'react';
import { copy } from '../../lib/copy';

/**
 * The design system's small shared pieces (app/ds.css): the mark, the wordmark, the arrow on a
 * primary button, the tick in a chosen bubble, the lock on something that's theirs, and the medical
 * note. Everything that uses them sits inside a `.ds` root.
 */

/** The eight-point chisel star with its spark. Decorative; hidden from screen readers. */
export function Mark({
  size,
  light,
  turning,
  className = '',
}: {
  size?: 'sm' | 'xs';
  light?: boolean;
  turning?: boolean;
  className?: string;
}) {
  const cls = ['ds-mark', size ? `ds-mark--${size}` : '', light ? 'ds-mark--light' : '', turning ? 'ds-mark--turning' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <svg className={cls} viewBox="0 0 40 40" aria-hidden="true">
      <path
        className="rays"
        d="M20 2.5l3.8 12.8 9.7-8.6-8.7 9.6 12.7 3.7-12.7 3.7 8.7 9.6-9.7-8.6L20 37.5l-3.8-12.8-9.7 8.6 8.7-9.6L2.5 20l12.7-3.7-8.7-9.6 9.7 8.6L20 2.5z"
      />
      <circle className="core" cx="20" cy="20" r="3.6" />
    </svg>
  );
}

/** The mark and the name, as the prototype's lockup. */
export function Brand({ light, size }: { light?: boolean; size?: 'sm' }) {
  return (
    <span className="ds-brand" translate="no">
      <Mark light={light} size={size} />
      <span>{copy.common.appName}</span>
    </span>
  );
}

/** The arrow at the end of a primary button. */
export function Arrow() {
  return (
    <span className="ds-arrow" aria-hidden="true">
      →
    </span>
  );
}

/** The tick inside a chosen bubble. */
export function Tick() {
  return <span className="ds-tick" aria-hidden="true" />;
}

export function LockIcon() {
  return (
    <svg className="ds-icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="10" width="12" height="10" rx="2" />
      <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" />
    </svg>
  );
}

/** "Yours. Distill never moves it." under a part that's theirs. */
export function Locked({ children }: { children: ReactNode }) {
  return (
    <span className="ds-lock">
      <LockIcon />
      {children}
    </span>
  );
}

/** The medical note, quiet at the bottom of the early onboarding screens. */
export function Disclaimer() {
  return <p className="ob-disclaimer">{copy.common.disclaimer}</p>;
}

/** A tappable bubble: round, raised, and ink with a tick once chosen. */
export function Bubble({
  on,
  onClick,
  children,
  className = '',
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={`ds-bubble${className ? ` ${className}` : ''}`}
      onClick={onClick}
    >
      {children}
      {on ? <Tick /> : null}
    </button>
  );
}
