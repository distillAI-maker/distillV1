import type { Metadata, Viewport } from 'next';
import { Newsreader } from 'next/font/google';
import type { ReactNode } from 'react';
import { ProgressProvider } from '../lib/progress/context';
import { currentUser } from '../lib/supabase/server';
import './globals.css';

/** Switzer, the landing page's face, from Fontshare (free licence). TODO: self-host the files. */
/** Headings: a book serif with a quiet luxury, paired with Switzer for everything else. */
const display = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});
const switzer = 'https://api.fontshare.com/v2/css?f[]=switzer@300,400,500,600&display=swap';

export const metadata: Metadata = {
  title: { default: 'Distill', template: '%s · Distill' },
  description:
    'What you do for yourself, edited. Everything you take, buy and do, read against your own data.',
  robots: { index: false },
};
export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
};

// Runs before paint so a saved "less motion" choice never flashes full motion.
const motionBoot =
  "try{if(localStorage.getItem('distill.motion')==='reduce')document.documentElement.dataset.motion='reduce'}catch(e){}";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  return (
    <html
      lang="en"
      className={display.variable}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={switzer} />
        <script dangerouslySetInnerHTML={{ __html: motionBoot }} />
      </head>
      <body>
        <ProgressProvider key={user?.id ?? 'device'} userId={user?.id}>
          {children}
        </ProgressProvider>
      </body>
    </html>
  );
}
