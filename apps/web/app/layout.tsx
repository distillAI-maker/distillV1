import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Manrope } from 'next/font/google';
import type { ReactNode } from 'react';
import { ProgressProvider } from '../lib/progress/context';
import './globals.css';

const sans = Manrope({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const serif = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Distill', template: '%s · Distill' },
  description:
    'What you do for yourself, edited. Everything you take, buy and do, read against your own data.',
  robots: { index: false },
};
export const viewport: Viewport = {
  themeColor: '#100f0b',
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
      className={`${sans.variable} ${serif.variable}`}
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
