import type { Metadata, Viewport } from 'next';
import { Geist_Mono, Italiana, Sora } from 'next/font/google';
import type { ReactNode } from 'react';
import { ProgressProvider } from '../lib/progress/context';
import './globals.css';

const sora = Sora({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });
const italiana = Italiana({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-wordmark',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Distill', template: '%s · Distill' },
  description:
    'Everything you take, buy and do for sleep and recovery, read against your own nights.',
  robots: { index: false },
};
export const viewport: Viewport = {
  themeColor: '#15211F',
  width: 'device-width',
  initialScale: 1,
};

// Runs before paint so a saved "less motion" choice never flashes full motion.
const motionBoot =
  "try{if(localStorage.getItem('distill.motion')==='reduce')document.documentElement.dataset.motion='reduce'}catch(e){}";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${sora.variable} ${mono.variable} ${italiana.variable}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: motionBoot }} />
      </head>
      <body>
        <ProgressProvider>{children}</ProgressProvider>
      </body>
    </html>
  );
}
