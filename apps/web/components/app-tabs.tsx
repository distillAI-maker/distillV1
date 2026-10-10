'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { copy } from '../lib/copy';
import { Icon } from './icon';
import type { IconName } from './icon';

const tabs: { href: string; label: string; icon: IconName }[] = [
  { href: '/home', label: copy.tabs.file, icon: 'pass' },
  { href: '/today', label: copy.tabs.today, icon: 'cal' },
  { href: '/verdicts', label: copy.tabs.verdicts, icon: 'checkc' },
  { href: '/settings', label: copy.tabs.settings, icon: 'toggle' },
];

/** The app's four places. In the bar on a laptop, along the bottom on a phone. */
export function AppTabs({ variant }: { variant: 'bar' | 'bottom' }) {
  const pathname = usePathname() ?? '';
  return (
    <nav className={variant === 'bar' ? 'tabs' : 'tabbar'} aria-label={copy.tabs.label}>
      {tabs.map((t) => {
        const current = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link key={t.href} href={t.href} aria-current={current ? 'page' : undefined}>
            <Icon name={t.icon} />
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
