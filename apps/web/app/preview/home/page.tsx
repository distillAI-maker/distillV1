import type { Metadata } from 'next';
import { Cinzel } from 'next/font/google';
import { HomeMock } from './home-mock';

const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-inscription',
  display: 'swap',
});

export const metadata: Metadata = { title: 'Your Standard (preview)' };

/**
 * A design mock of the app home in the October direction (docs/DIRECTION.md): the demo person's
 * Standard, one thing for today, what we're noticing, the collection, and one suggestion. Static
 * content; not wired to the engine yet.
 */
export default function HomePreview() {
  return (
    <div className={cinzel.variable}>
      <HomeMock />
    </div>
  );
}
