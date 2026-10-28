import type { ReactNode } from 'react';

/** The prototype's thin line icons. Decorative; the label beside each one names it. */
const paths: Record<string, ReactNode> = {
  ritual: (
    <>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      <circle cx="12" cy="12" r="5" />
    </>
  ),
  things: (
    <path d="M5 8.5C5 6 7 4 9.5 4c1 0 1.9.3 2.5.9.7-.6 1.5-.9 2.5-.9C17 4 19 6 19 8.5c0 4.5-7 10.5-7 10.5S5 13 5 8.5Z" />
  ),
  explore: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="m15.5 8.5-2.1 4.9-4.9 2.1 2.1-4.9 4.9-2.1Z" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" />
    </>
  ),
  check: <path d="m6 12 4 4 8-9" />,
  arrow: <path d="m9 18 6-6-6-6" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
};

export type IconName = 'ritual' | 'things' | 'explore' | 'settings' | 'check' | 'arrow' | 'close';

export function Icon({ name, className = 'ds-icon' }: { name: IconName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
