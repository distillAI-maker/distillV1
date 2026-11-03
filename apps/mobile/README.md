# Distill for iOS

The App Store app. A native shell (Capacitor 8) around the live app at https://distill-app-nu.vercel.app: it opens the same Next.js app as the website, so every merge to `main` reaches the iPhone app too, with no new build or review. A new build is only needed when something in this folder changes.

Submitting to the App Store, the listing and the privacy answers: [`docs/APP-STORE.md`](../../docs/APP-STORE.md).

## What the shell adds

| | Where |
| --- | --- |
| Sign-in links open in the app (universal links), not Safari, so the session lands where someone asked for it | `App.entitlements`, `DistillViewController.openLink`, `apps/web/app/.well-known/apple-app-site-association` |
| The launch screen holds (ground and star, the star turning if it takes a while) until the first page has drawn | `LaunchScreen.storyboard`, `DistillViewController.showCover` |
| Edge to edge: the page pads for the notch and home bar with `env(safe-area-inset-*)`, switched on in the app only | `DistillViewController.fitScript`, the `safe-area-inset-top` lines in `apps/web/app/ds.css` |
| The screen ends where the keyboard begins, so a screen's button stays above it, and there is no previous / next / done bar | `DistillViewController.container`, `hideFormBar` |
| Offline, a Distill screen with Try again instead of a blank page | `www/offline.html`, `NavigationPolicy.failed` |
| Other sites open in a Safari sheet over the app; wearable sign-ins (Oura, WHOOP) stay in the app so their callback finds the session | `NavigationPolicy`, `allowNavigation` in `capacitor.config.ts` |
| Swipe from the edge to go back | `allowsBackForwardNavigationGestures` |
| Icon (light, dark, tinted), privacy manifest, light mode, portrait, iPhone only | `Assets.xcassets`, `PrivacyInfo.xcprivacy`, `Info.plist` |

The web app can tell it is inside the iOS app: the user agent ends in `DistillApp/iOS`, and the first visit is tagged `?src=ios-app` for the funnel (`lib/track.ts`).

## Setup

Needs Xcode 26 or later and Node 24. This folder is outside the pnpm workspace (it has its own `package-lock.json`), so:

```bash
cd apps/mobile && npm ci && npm run sync
```

`npm run sync` copies `www/` and the config into the Xcode project. Run it after changing anything in `www/` or `capacitor.config.ts`. Then open `ios/App/App.xcodeproj` in Xcode (`npm run open`), pick an iPhone simulator and Run.

## Trying web changes in the app

Point the app at a local `pnpm dev` instead of the live site:

```bash
npm run sync:local
```

Run the app from Xcode as usual; it loads http://localhost:3000. **Run `npm run sync` before archiving**, or the build would open localhost.

## Changing the icon

`scripts/make-icons.sh` draws the three icons and the launch star from the brand mark with headless Chrome, the same way `scripts/export_brand_pngs.sh` does. Change the colours or the star's size at the bottom of the script and run it again.

## Good to know

- There is no `Main.storyboard`: `SceneDelegate` builds the window in code with `DistillViewController`. Don't run `cap add ios` again; it would overwrite the native files.
- Raise the build number (`CURRENT_PROJECT_VERSION`) for every upload, and `MARKETING_VERSION` for each release people see.
- Capacitor's Swift package is pinned in `Package.resolved`; `npm run sync` rewrites `CapApp-SPM/Package.swift` when Capacitor is upgraded in `package.json`.
