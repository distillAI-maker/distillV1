'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { copy } from '../../lib/copy';
import type { ScreenId } from '../../lib/funnel';
import { useScreen } from '../../lib/track';
import { Icon, type IconName } from './icons';

const tabs: { href: string; icon: IconName; label: string; screen: ScreenId }[] = [
  { href: '/ritual', icon: 'ritual', label: copy.shell.tabs.ritual, screen: 'ritual' },
  { href: '/things', icon: 'things', label: copy.shell.tabs.things, screen: 'things' },
  { href: '/explore', icon: 'explore', label: copy.shell.tabs.explore, screen: 'explore' },
  { href: '/settings', icon: 'settings', label: copy.shell.tabs.settings, screen: 'settings' },
];

const under = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

/** The four places along the bottom: Ritual, Your things, Explore, Settings. */
export function TabBar() {
  const path = usePathname() ?? '';
  // Every tab draws this bar, so it counts which one is showing.
  useScreen(tabs.find((t) => under(path, t.href))?.screen);
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
