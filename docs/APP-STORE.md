# Distill on the App Store

29 October 2026. The iOS app is built (`apps/mobile`, see its README) and runs in the Simulator. This is everything between it and the App Store: what to set up once, how to upload a build, and the listing, privacy answers and review notes to paste into App Store Connect.

## Where it stands

| Step | Who | State |
| --- | --- | --- |
| iOS app: shell, icon, launch screen, offline screen, sign-in links, privacy manifest | Claude | Done, tested in the Simulator (iPhone 18 Pro, iOS 27) |
| Web: safe areas, `/privacy`, `/support`, Settings links, the sign-in-link file | Claude | In this PR; live when it merges |
| An Apple Developer Program membership, as an organization (decided 29 October) | A founder who can sign for the company | **Open:** needs a registered company and its D-U-N-S number first (section 1) |
| Team ID into the Xcode project and onto Vercel (`APPLE_TEAM_ID`) | Ishan | After the membership |
| The engine live in production (HANDOVER priority 1) | Rohan | Check before submitting: a reviewer who signs in must get a first Ritual |
| App Store Connect record, listing, privacy answers | Ishan, Veer signs off the words | Drafts below |
| Screenshots | Claude; Veer signs off | Seven taken, in `apps/mobile/store/screenshots/` |
| Upload, TestFlight, submit for review | Ishan | After the above |

## 1. Once: the developer account

Decided 29 October: Distill enrolls as an organization, so the listing shows the company as the seller. Apple checks all of this before it takes the $99 a year:

| Apple needs | Where Distill is |
| --- | --- |
| A legal entity: a registered company (an LLC or a corporation). A trade name or DBA doesn't count. | **Open.** If Distill isn't registered yet, this comes first. The kind of company matters for taxes, ownership and fundraising, so choose it as a team with a lawyer or a startup legal clinic; Apple only needs it to exist. |
| A D-U-N-S number for that company (free, from Dun & Bradstreet) | **Open.** Look it up, or request one, at https://developer.apple.com/enroll/duns-lookup/ with the company's exact legal name and address. D&B takes up to 5 business days, then Apple up to 2 more. |
| The person who enrolls can sign for the company: an owner or founder, an executive, or someone they authorise | **Open: pick who.** They become the Account Holder, the one person who accepts Apple's agreements. Anyone who isn't an owner or founder gives Apple a reference who confirms their authority. |
| An Apple Account with two-factor authentication, in that person's legal first and last name, on a work email at the company's domain | **Ready.** Any address at distillthenoise.com reaches the team inbox (disttilai@gmail.com) through the ImprovMX catch-all, so make a new Apple Account with, say, apple@distillthenoise.com. Send it a test email first. |
| A public, working website on that domain | **Ready:** https://distillthenoise.com serves the landing page. www.distillthenoise.com shows a certificate warning until it's added to the distill-v1 project on Vercel as a redirect to distillthenoise.com. |

Then:

1. Enroll at https://developer.apple.com/programs/enroll with that Apple Account. Keep the company's registration papers to hand: Apple may ask for notarised copies, or phone to check.
2. When Apple emails that it has verified the company, accept the license agreement and pay.
3. Users and Access: invite Ishan as an Admin (Admins can sign, archive and upload).
4. In Xcode (Settings, Accounts), add the Apple Account that's on the team.

Allow about two to three weeks from a registered company to an active membership; most of it is D&B and Apple's checks.

**Until then, on your own iPhone, free.** Xcode can put the app on a phone with any Apple Account's free Personal Team (the app runs for 7 days, then install it again). For that build only, in Signing & Capabilities: pick the Personal Team, add `.dev` to the bundle identifier (so the real one stays free for the company's team) and remove Associated Domains (personal teams can't have it). Don't commit those changes. On the phone, turn on Developer Mode (Settings, Privacy & Security) and trust the developer (Settings, General, VPN & Device Management). Everything works except sign-in links, which open in Safari without the association.

## 2. Once: connect the app to the account

1. Open `apps/mobile/ios/App/App.xcodeproj`, select the App target, Signing & Capabilities: pick the team. Xcode registers `com.distillthenoise.app` and adds the Associated Domains capability (the entitlement is already in `App.entitlements`).
2. Copy the 10-character Team ID (developer.apple.com, Membership). On Vercel, project distill-app, add `APPLE_TEAM_ID` for Production and redeploy.
3. Check https://distill-app-nu.vercel.app/.well-known/apple-app-site-association shows JSON with `<TEAM ID>.com.distillthenoise.app`. Apple's copy updates within a day: https://app-site-association.cdn-apple.com/a/v1/distill-app-nu.vercel.app
4. Nothing changes in Supabase: the sign-in link already goes to `https://distill-app-nu.vercel.app/auth/callback`, which the app now opens.
5. App Store Connect, Apps, New App: platform iOS, name (below), language English (U.S.), bundle ID `com.distillthenoise.app`, SKU `distill-ios-1`, full access.
6. Put the company's legal name in the copyright line (section 4) and at the top of the privacy page, so people know who "we" are.

## 3. Every build: upload

1. `cd apps/mobile && npm ci && npm run sync` (never after `sync:local`).
2. Raise `CURRENT_PROJECT_VERSION` in the project (1 is the first build; `MARKETING_VERSION` is 1.0).
3. Xcode: choose Any iOS Device, Product, Archive, then Distribute App, App Store Connect, Upload.
4. When it finishes processing (10 to 30 minutes), it appears in TestFlight. Add the team as internal testers and try it on real phones, including the sign-in email.

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

**Price and availability:** free; the United States only at first, where the wedge is. Apple asks every developer to declare an EU trader status (Business, Agreements, Compliance), and a trader's address, phone and email appear on its EU product pages, so add EU countries once there's a business address to show.

**URLs:** support https://distill-app-nu.vercel.app/support · privacy https://distill-app-nu.vercel.app/privacy · marketing https://distill-v1-tau.vercel.app

**Copyright:** 2026 and the company's legal name, the same name Apple shows as the seller.

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
| Usage data: product interaction (funnel steps, a random device number) | No | Analytics |

The same list is in `PrivacyInfo.xcprivacy` (financial info aside, which Apple's manifest doesn't ask for). If a new feature sends something new (crash reports, analytics, payments), update both and the privacy page.

## 6. Notes for the reviewer

> Distill is a wellness companion that helps people clear the supplements, apps and routines they picked up from feeds, and shapes a daily "Ritual" around what they keep. It is not a medical app: it never diagnoses or treats, anything a clinician prescribed is never touched, and a message mentioning crisis is answered with the 988 Suicide & Crisis Lifeline.
>
> No account is needed: tap Begin, enter a first name, tap a few items (or "Try it with an example stack"), answer the short questions, and you reach your Ritual and the four tabs. Signing in is optional and only keeps the Ritual across devices; it works by an emailed link, which opens in the app.
>
> Account deletion: Settings, Delete everything (deletes the account and all its data at once). Privacy policy: Settings, Privacy policy.
>
> The app shows our web app inside a native shell with: sign-in links that open in the app, a native launch and offline screen, outside links in an in-app browser, keyboard and safe-area handling, and a privacy manifest. Content comes from our own server; there are no ads and no third-party tracking.

## 7. Risks and what would help next

- **Guideline 4.2 (minimum functionality).** Apple can reject apps that feel like a website in a frame. Distill already looks and behaves like an app (onboarding, tabs, no browser chrome, native launch and offline screens), which is usually enough. If it is rejected, the strongest answers are native features the website can't have: gentle Ritual reminders as notifications (opt-in, matching "Gentle messages, coming soon" in Settings), Apple Health sleep instead of a wearable login, or a widget for today's Ritual.
- **Sign-in on another device.** A link opened on a laptop signs in the laptop, not the phone. A six-digit code in the same email (Supabase `{{ .Token }}`) with a code box on the sign-in screen would let people finish on the phone. Rohan and Veer's areas.
- **Paid membership later.** Selling a digital membership inside the iOS app requires Apple's in-app purchase (guideline 3.1.1); in the US the app may instead link to the website to pay. Decide before any price appears in the app (`PRICING_ENABLED`).
- **Big changes still go through review in spirit.** The web app can change without a new build, but the app has to stay what was reviewed (guideline 2.3.1). New data collection means updating the privacy answers first.
