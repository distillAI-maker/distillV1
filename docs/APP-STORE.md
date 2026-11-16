# Distill on the App Store

16 November 2026. Build 1.0 (1) is uploaded to App Store Connect under the Lin Yang team. This is everything between it and the App Store: what was set up once, how to upload a build, and the listing, privacy answers and review notes to paste into App Store Connect.

## Where it stands

| Step | Who | State |
| --- | --- | --- |
| iOS app: shell, icon, launch screen, offline screen, sign-in links, privacy manifest | Claude | Done, tested in the Simulator (iPhone 18 Pro, iOS 27) |
| Web: safe areas, `/privacy`, `/support`, Settings links, the sign-in-link file | Claude | Live; the sign-in-link file answers since `APPLE_TEAM_ID` was set (16 November) |
| Developer account: the Lin Yang Individual team, `NT3W645293`, the same account as xTrain (decided 16 November) | Lin Yang | Done |
| Team ID in the Xcode project and on Vercel (`APPLE_TEAM_ID`, project distill-app) | Ishan | Done, 16 November |
| App Store Connect record, bundle ID `com.distillthenoise.app` | Ishan | Done, 16 November |
| Build 1.0 (1) uploaded | Claude | Done, 16 November (`npm run upload`, section 3) |
| The engine live in production (HANDOVER priority 1) | Rohan | Check before submitting: a reviewer who signs in must get a first Ritual |
| Listing, privacy answers, age rating | Ishan, Veer signs off the words | Drafts below |
| Screenshots | Claude; Veer signs off | Seven from 29 October, in `apps/mobile/store/screenshots/`; retake after the 12 November onboarding redesign |
| A way past the email step without giving an email | Claude; Veer signs off | Done: "Not now" under Join free goes straight into the demo (counted as `email_skipped`). Apple often rejects apps that ask for personal details before features that don't need an account (guideline 5.1.1) |
| TestFlight on real phones, then submit for review | Ishan | Next |

## 1. Once: the developer account

Decided 16 November: Distill is published by the existing **Lin Yang** Individual team (Team ID `NT3W645293`), the same Apple account as xTrain. This replaces the 2 November plan for a membership in Ishan's name, and the 29 October plan to enroll as an organization. The App Store shows **Lin Yang** as the developer and seller, next to xTrain. If Distill gets its own account later, the app can be moved there with App Store Connect's app transfer; that needs a new `APPLE_TEAM_ID` on Vercel and a new build.

To build and upload, Xcode needs the team's Apple Account (Settings, Accounts). The team has no registered iPhone, so Xcode's Archive button fails with "Your team has no devices": use `npm run upload` (section 3), or plug in any iPhone once and pick it in Xcode's device menu, which registers it and makes the Archive button work.

## 2. Once: connect the app to the account (done 16 November)

1. In `apps/mobile/ios/App/App.xcodeproj`, the App target's team is `NT3W645293` (Signing & Capabilities, automatic signing). Xcode registered `com.distillthenoise.app`; the App Store profile carries Associated Domains (`App.entitlements`).
2. On Vercel, project **distill-app** (not distill-v1, the landing page), `APPLE_TEAM_ID` is `NT3W645293` for Production.
3. https://distill-app-nu.vercel.app/.well-known/apple-app-site-association shows `NT3W645293.com.distillthenoise.app`. Apple's copy updates within a day: https://app-site-association.cdn-apple.com/a/v1/distill-app-nu.vercel.app
4. Nothing changes in Supabase: the sign-in link already goes to `https://distill-app-nu.vercel.app/auth/callback`, which the app now opens.
5. App Store Connect, Apps, New App: platform iOS, name (below), language English (U.S.), bundle ID `com.distillthenoise.app`, SKU `distill-ios-1`, full access.

## 3. Every build: upload

1. Raise `CURRENT_PROJECT_VERSION` in the project (Xcode, App target, General, Build): 1 is uploaded, so the next is 2. Raise `MARKETING_VERSION` (1.0) for each release people see.
2. `cd apps/mobile && npm ci && npm run upload`. It syncs the live config (never a `sync:local` one), archives, signs for the App Store with the team's cloud certificate, checks the result is signed for distribution and still carries the sign-in-link entitlement, then uploads. `npm run upload -- --check` does everything but the upload. Logs and archives go to `~/.distill-ios`.
3. When it finishes processing (10 to 30 minutes), it appears in TestFlight. Add the team as internal testers and try it on real phones, including the sign-in email.

Web-only changes never need a new build: the app loads the live site.

## 4. The listing

**Name** (30 max): Distill: Your Ritual. If it is taken, Distill: Less Noise.

**Subtitle** (30): Less noise. More you.

**Promotional text** (170, changeable any time): Tap what you take and do. See what can go and the money back, then a Ritual built around your mornings, nights and weekends.

**Description:**

> There's so much noise. Feeds, podcasts and ads tell you what to take, track and become, and doing all of it wears you down.
>
> Distill clears the noise and builds your Ritual: the whole system of your mornings, days, nights and weekends, shaped around who you are.
>
> Start with what you already do
> Tap the supplements, memberships, apps and routines you've picked up along the way. Distill shows you what can go, on evidence, and the money you get back. What works for you stays, and anything a clinician gave you is never touched.
>
> A Ritual that's yours
> A few quick questions about the days you feel most like yourself, and Distill shapes your first Ritual: mostly things you already do and love, organised so they fit your life.
>
> Quietly in your control
> Everything is a proposal, and when you say "this is mine", that's final. No streaks, no scores, no guilt. Use Distill without an account, or sign in with your email to keep your Ritual on any device. See everything Distill knows about you, download it, or delete all of it in one tap.
>
> Distill is a wellness companion, not a medical product, and nothing in it is medical advice.
>
> Less noise. More you.

Once the engine is live in production, add a paragraph on reshaping: "Out late with the team tonight? Tell Distill, and tomorrow starts slower."

**Keywords** (100): routine,supplements,wellness,habits,morning,sleep,stack,simplify,mindful,calm,declutter,overwhelm

**Category:** Health & Fitness; secondary Lifestyle.

**Price and availability:** free; the United States only at first, where the wedge is. Apple asks every developer to declare an EU trader status (Business, Agreements, Compliance), and a trader's address, phone and email appear on its EU product pages (for this Individual membership, Lin Yang's), so add EU countries once there's a business address to show.

**URLs:** support https://distill-app-nu.vercel.app/support · privacy https://distill-app-nu.vercel.app/privacy · marketing https://distillthenoise.com

**Copyright:** 2026 Lin Yang, the name Apple shows as the seller.

**Screenshots** (6.9-inch, 1320 x 2868, required): seven are in `apps/mobile/store/screenshots/`, taken in the iPhone 18 Pro Max Simulator from this branch's web app with a sample person (Maya, 14 things): the noise, tap your stack, the number, what can go, your Ritual, the Ritual tab, the private study. They are JPEGs without transparency, as App Store Connect asks. Upload them in that order; retake any screen that changes before submitting. iPhone only, so no iPad screenshots are needed.

**Age rating:** answer the questionnaire as the app is: no violence, sexual content, gambling or user-to-user contact; "Alcohol, Tobacco, or Drug Use or References: Infrequent/Mild" (people's own wine nights, supplements); "Medical or Treatment Information: Infrequent/Mild" (evidence about supplements, never advice). The privacy page says Distill is for adults (18+); if the questionnaire comes out lower, either set the age rating to 18+ in App Store Connect or change that line. A team decision.

## 5. App privacy (the "nutrition label")

From what the code collects (`apps/web`, `supabase/migrations`, `lib/track.ts`). Nothing is used for tracking.

| Data type | Linked to the person | Purposes |
| --- | --- | --- |
| Contact info: email address | Yes | App functionality (sign-in) |
| Contact info: name (first name) | Yes | App functionality |
| Health & fitness: health (their stack, wellness notes, nights from Oura or WHOOP) | Yes | App functionality, product personalization |
| User content: other user content (answers, notes, ideal day, messages) | Yes | App functionality, product personalization |
| Identifiers: user ID | Yes | App functionality |
| Financial info: other financial info (what their stack costs them) | Yes | App functionality |
| Usage data: product interaction (screens reached and the time on each, a random device number) | No | Analytics |

The same list is in `PrivacyInfo.xcprivacy` (financial info aside, which Apple's manifest doesn't ask for). If a new feature sends something new (crash reports, analytics, payments), update both and the privacy page.

## 6. Notes for the reviewer

> Distill is a wellness companion that helps people clear the supplements, apps and routines they picked up from feeds, and shapes a daily "Ritual" around what they keep. It is not a medical app: it never diagnoses or treats, anything a clinician prescribed is never touched, and a message mentioning crisis is answered with the 988 Suicide & Crisis Lifeline.
>
> No account is needed: tap Begin, enter a first name, tap a few items, answer the short questions, and on the email screen tap "Not now" to reach your Ritual and the four tabs. Signing in is optional and only keeps the Ritual across devices; it works by an emailed link, which opens in the app.
>
> Account deletion: Settings, Delete everything (deletes the account and all its data at once). Privacy policy: Settings, Privacy policy.
>
> The app shows our web app inside a native shell with: sign-in links that open in the app, a native launch and offline screen, outside links in an in-app browser, keyboard and safe-area handling, and a privacy manifest. Content comes from our own server; there are no ads and no third-party tracking.

## 7. Risks and what would help next

- **Guideline 4.2 (minimum functionality).** Apple can reject apps that feel like a website in a frame. Distill already looks and behaves like an app (onboarding, tabs, no browser chrome, native launch and offline screens), which is usually enough. If it is rejected, the strongest answers are native features the website can't have: gentle Ritual reminders as notifications (opt-in, matching "Gentle messages, coming soon" in Settings), Apple Health sleep instead of a wearable login, or a widget for today's Ritual.
- **Sign-in on another device.** A link opened on a laptop signs in the laptop, not the phone. A six-digit code in the same email (Supabase `{{ .Token }}`) with a code box on the sign-in screen would let people finish on the phone. Rohan and Veer's areas.
- **Paid membership later.** Selling a digital membership inside the iOS app requires Apple's in-app purchase (guideline 3.1.1); in the US the app may instead link to the website to pay. Decide before any price appears in the app (`PRICING_ENABLED`).
- **Big changes still go through review in spirit.** The web app can change without a new build, but the app has to stay what was reviewed (guideline 2.3.1). New data collection means updating the privacy answers first.
