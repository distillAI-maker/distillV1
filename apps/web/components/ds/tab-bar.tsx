'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { copy } from '../../lib/copy';
import { Icon, type IconName } from './icons';

const tabs: { href: string; icon: IconName; label: string }[] = [
  { href: '/ritual', icon: 'ritual', label: copy.shell.tabs.ritual },
  { href: '/things', icon: 'things', label: copy.shell.tabs.things },
  { href: '/explore', icon: 'explore', label: copy.shell.tabs.explore },
  { href: '/settings', icon: 'settings', label: copy.shell.tabs.settings },
];

const under = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

/** The four places along the bottom: Ritual, Your things, Explore, Settings. */
export function TabBar() {
  const path = usePathname() ?? '';
  return (
    <nav className="ds-tokens ds-tabbar" aria-label={copy.tabs.label}>
      {tabs.map((t) => {
        const on = under(path, t.href);
        return (
          <Link key={t.href} href={t.href} aria-current={on ? 'page' : undefined}>
            <Icon name={t.icon} />
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
