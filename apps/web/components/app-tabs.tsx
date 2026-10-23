'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { copy } from '../lib/copy';
import { useProgress } from '../lib/progress/context';
import { DStar } from './d-star';

const icon = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', 'aria-hidden': true } as const;

const tabs = [
  {
    href: '/today',
    label: copy.app.tabs.today,
    icon: (
      <svg viewBox="0 0 24 24" {...icon}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l2.5 2.5" />
      </svg>
    ),
  },
  {
    href: '/companion',
    label: copy.app.tabs.companion,
    icon: (
      <svg viewBox="0 0 24 24" {...icon} strokeLinejoin="round">
        <path d="M4 4h16v12H4z" />
        <path d="M8 20l4-4" />
      </svg>
    ),
  },
  { href: '/home', label: copy.app.tabs.home, icon: <DStar /> },
  {
    href: '/settings',
    label: copy.app.tabs.settings,
    icon: (
      <svg viewBox="0 0 24 24" {...icon}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2m-3.22-7.78-1.42 1.42M5.64 18.36l-1.42 1.42m0-14.14 1.42 1.42m11.3 11.3 1.42 1.42" />
      </svg>
    ),
  },
];

const under = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

/** The app's four places along the bottom: Today, Distill, Standard, Settings. */
export function AppTabs() {
  const path = usePathname() ?? '';
  return (
    <nav className="d-tabbar" aria-label={copy.tabs.label}>
      {tabs.map((t) => {
        const on = under(path, t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`d-tabbar__item${on ? ' d-tabbar__item--active' : ''}`}
            aria-current={on ? 'page' : undefined}
          >
            <span className="d-tabbar__icon">{t.icon}</span>
            <span className="d-tabbar__label">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Which place this is, on the left of the folio rule. */
export function folioFor(path: string): string {
  const f = copy.app.folio;
  if (under(path, '/home/you')) return f.you;
  if (under(path, '/home')) return f.home;
  if (under(path, '/today/reading') || under(path, '/verdicts')) return f.readings;
  if (under(path, '/today')) return f.today;
  if (under(path, '/companion')) return f.companion;
  if (under(path, '/settings')) return f.settings;
  if (under(path, '/file')) return f.file;
  return '';
}

/** The folio under the top bar: where you are, and whose it is. */
export function AppFolio() {
  const path = usePathname() ?? '';
  const { ready, progress } = useProgress();
  const first = ready ? (progress.name.trim().split(/\s+/)[0] ?? '') : '';
  return (
    <div className="d-folio d-folio--app" aria-hidden="true">
      <span>{folioFor(path)}</span>
      <span>{first}</span>
    </div>
  );
}
