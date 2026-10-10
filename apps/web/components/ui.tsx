'use client';

import Link from 'next/link';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { useId } from 'react';
import { copy } from '../lib/copy';
import { Icon } from './icon';

type Variant = 'primary' | 'ghost' | 'link';

function cls(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

export function Button({
  variant = 'primary',
  size,
  block,
  busy,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: 'sm';
  block?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      className={cls(
        'btn',
        `btn-${variant}`,
        size === 'sm' && 'btn-sm',
        block && 'btn-block',
        busy && 'busy',
        className,
      )}
      aria-busy={busy || undefined}
      disabled={rest.disabled || busy}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = 'primary',
  size,
  block,
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: 'sm';
  block?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cls(
        'btn',
        `btn-${variant}`,
        size === 'sm' && 'btn-sm',
        block && 'btn-block',
        className,
      )}
    >
      {children}
    </Link>
  );
}

/** A pressable chip. Single-select groups use role="radio"; multi-select uses aria-pressed. */
export function Chip({
  selected,
  radio,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean; radio?: boolean }) {
  return (
    <button
      type="button"
      className="chip"
      role={radio ? 'radio' : undefined}
      aria-checked={radio ? selected : undefined}
      aria-pressed={radio ? undefined : selected}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  error,
  unit,
  id,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
  unit?: string;
}) {
  const auto = useId();
  const inputId = id ?? auto;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const control = (
    <input
      id={inputId}
      aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
      aria-invalid={error ? true : undefined}
      {...input}
    />
  );
  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      {unit ? (
        <div className="field-unit">
          {control}
          <span className="unit">{unit}</span>
        </div>
      ) : (
        control
      )}
      {hint ? (
        <p className="hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="notice" role="alert" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Skeleton({
  kind,
  count = 1,
}: {
  kind: 'option' | 'line' | 'title';
  count?: number;
}) {
  return (
    <div className="stack-tight" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={`sk sk-${kind}`} />
      ))}
    </div>
  );
}

export function Wordmark({ large, href }: { large?: boolean; href?: string }) {
  const className = cls('wordmark', large && 'wordmark-lg');
  if (href)
    return (
      <Link href={href} className={className} translate="no" aria-label="Distill">
        Distill
      </Link>
    );
  return (
    <span className={className} translate="no" aria-label="Distill">
      Distill
    </span>
  );
}

export function Footer({ links }: { links?: { href: string; label: string }[] }) {
  return (
    <footer className="foot">
      <div className="wrap">
        <Wordmark />
        {links?.length ? (
          <nav aria-label={copy.common.footerNav}>
            {links.map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
          </nav>
        ) : null}
        <p className="legal">{copy.common.disclaimer}</p>
      </div>
    </footer>
  );
}

export function BackButton({ href, onClick }: { href?: string; onClick?: () => void }) {
  const label = copy.common.back;
  if (href)
    return (
      <Link href={href} className="iconbtn" aria-label={label}>
        <Icon name="back" />
      </Link>
    );
  return (
    <button type="button" className="iconbtn" aria-label={label} onClick={onClick}>
      <Icon name="back" />
    </button>
  );
}
