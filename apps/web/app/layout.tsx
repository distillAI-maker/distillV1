import type { Metadata, Viewport } from 'next';
import { Newsreader, Source_Sans_3 } from 'next/font/google';
import type { ReactNode } from 'react';
import { ProgressProvider } from '../lib/progress/context';
import { currentUser } from '../lib/supabase/server';
import './globals.css';

/** The brand board's pair: Newsreader (light for display, italic accents) and Source Sans 3 for UI. */
const display = Newsreader({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});
const sans = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Distill', template: '%s · Distill' },
  description: 'Wellness tailored to who you are. Clear the noise and live your own ritual.',
  robots: { index: false },
};
export const viewport: Viewport = {
  themeColor: '#f0ece2',
  width: 'device-width',
  initialScale: 1,
};

// Runs before paint so a saved "less motion" choice never flashes full motion. It also keeps where
// someone first came from (?src=class on the QR code), for the launch funnel (lib/track.ts).
const motionBoot =
  "try{if(localStorage.getItem('distill.motion')==='reduce')document.documentElement.dataset.motion='reduce'}catch(e){}" +
  "try{var s=new URLSearchParams(location.search).get('src');if(s&&/^[A-Za-z0-9_.-]{1,40}$/.test(s)&&!localStorage.getItem('distill.source'))localStorage.setItem('distill.source',s)}catch(e){}";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
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
