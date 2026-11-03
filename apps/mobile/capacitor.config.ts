import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The iOS app is a native shell around the live app: it loads LIVE, so every merge to main reaches
 * the App Store app too, with no new build. The files in www/ ship inside the app and only show when
 * the live app can't be reached (offline.html).
 */
const LIVE = 'https://distill-app-nu.vercel.app';
// `npm run sync:local` points the app at a local `pnpm dev` instead, to try web changes in the
// Simulator. Run `npm run sync` again before archiving a build.
const APP = new URL(process.env.DISTILL_APP_URL ?? LIVE);

const config: CapacitorConfig = {
  appId: 'com.distillthenoise.app',
  appName: 'Distill',
  webDir: 'www',
  server: {
    // ?src= tags the funnel's events (lib/track.ts) as coming from the iOS app, the way ?src=class
    // tags the class QR code.
    url: `${APP.origin}/?src=ios-app`,
    errorPath: 'offline.html',
    allowNavigation: [
      APP.hostname,
      // Wearable sign-in pages open inside the app, so the OAuth callback lands back in the app's
      // session instead of in Safari. Any other site opens in a Safari sheet over the app.
      'cloud.ouraring.com',
      '*.ouraring.com',
      'api.prod.whoop.com',
      '*.prod.whoop.com',
      '*.whoop.com',
      'www.fitbit.com',
      'accounts.fitbit.com',
    ],
  },
  ios: {
    backgroundColor: '#f2eee5',
    contentInset: 'never',
    // Lets the web app tell when it runs inside the iOS app (navigator.userAgent).
    appendUserAgent: 'DistillApp/iOS',
    allowsLinkPreview: false,
  },
};

export default config;
