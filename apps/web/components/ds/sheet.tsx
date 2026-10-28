'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icons';

/**
 * A sheet that slides up over the page: a handle, an eyebrow and title, a close button, and what
 * it holds. Escape or a tap outside closes it; focus moves in and goes back where it came from.
 */
export function Sheet({
  eyebrow,
  title,
  closeLabel,
  onClose,
  className = '',
  children,
}: {
  eyebrow?: string;
  title: string;
  closeLabel: string;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => setHost(document.body), []);
  useEffect(() => {
    if (!host) return;
    const before = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    document.addEventListener('keydown', key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', key);
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, [host]);
  if (!host) return null;
  return createPortal(
    <div className="ds-tokens ds-portal">
      <div className="ds-backdrop" onClick={onClose}>
        <section
          ref={panel}
          className={`ds-sheet${className ? ` ${className}` : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="ds-sheet-handle" />
          <div className="ds-sheet-head">
            <div>
              {eyebrow ? <span className="ds-eyebrow">{eyebrow}</span> : null}
              <h2>{title}</h2>
            </div>
            <button type="button" className="ds-round" aria-label={closeLabel} onClick={onClose}>
              <Icon name="close" />
            </button>
          </div>
          {children}
        </section>
      </div>
    </div>,
    host,
  );
}

/** An on/off switch. */
export function Toggle({
  on,
  labelledBy,
  onChange,
  disabled,
}: {
  on: boolean;
  labelledBy: string;
  onChange: (on: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      className="ds-toggle"
      aria-checked={on}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => onChange(!on)}
    >
      <i />
    </button>
  );
}
