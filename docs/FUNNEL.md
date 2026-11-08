# The funnel: where people stop

Every screen of onboarding and the app is counted, with the time spent on it and the screen people were on when they closed the app. The team reads it on one page in the app. Only screens, times and taps are stored: never what anyone writes, their name or their email.

## Reading it

**The page:** https://distill-app-nu.vercel.app/team. Sign in with your email first (the link lands on your Ritual), then open `/team`. Only the addresses in `TEAM_EMAILS` can see it; anyone else gets a 404.

**Setting it up (once):** in Vercel, `distill-app` → Settings → Environment Variables, add `TEAM_EMAILS` for Production, the team's addresses separated by commas, then redeploy. `DATABASE_URL` is already set.

**Your own testing:** at the bottom of the page, "Don't count this device" stops this browser from sending anything. Do it on every phone and laptop you test with. It's kept per browser, so do it again in a new one.

**In a terminal** (needs `DATABASE_URL` in `apps/web/.env.local`):

```bash
npx tsx apps/web/scripts/funnel.ts 7d
```

Ranges are `24h`, `7d`, `30d` and `all`; add a source to see only those people (`npx tsx apps/web/scripts/funnel.ts 30d class`).

### What each number means

People are grouped by when their device was first counted, so "7 days" means everyone who first arrived in the last 7 days, followed through everything they did since.

| Number | Meaning |
| --- | --- |
| Started onboarding | Devices that saw any onboarding screen |
| Reached | Got at least this far (someone who resumed partway counts as having passed the screens before) |
| Stopped here | Got this far and no further, and hasn't done anything for 30 minutes. The biggest one is highlighted |
| Still going | Not through yet, but active in the last 30 minutes |
| Time on it | Median time from the screen showing to the next one, counted only while the page is in view |
| Where they were when they stopped | The last screen each person saw. Usually the same as "stopped here", except for someone who went back (Change something) and left there |
| Time there | Median time on that last screen before the page was hidden or closed |
| Opened the email link, same browser / any browser | The link often opens in the mail app's own browser, which counts as a new device, so it's counted on its own as well |
| In the app | Devices that opened a tab, including accounts opening on a new device. Signed in or only the demo, and whether they came back on another day (Pacific time) |
| Where they came from | `?src=` on their first visit: `class` for the QR code, `site` for the landing page's link, `direct` for none |
| Milestones | The older once-per-device counts, from before screens were counted (13 Oct to 7 Nov) |

## What's stored

Each row in `public/app_events` (`supabase/migrations/20261013000001_app_events.sql`) is one event: a random device id kept in the browser (`distill.device`), the event, a few small values, the source, and the time. The browser sends it to `POST /api/event` (`apps/web/app/api/event/route.ts`), which only takes the known events and values in `apps/web/lib/funnel.ts`.

- `screen`: a screen showed. `s` is the screen, `prev` the one before it, `ms` the time spent on that one.
- `left`: the page was hidden or closed. `s` is the screen it was on, `ms` the time on it so far.
- Taps: `made_it_mine`, `change_something`, `link_sent`, `link_failed`, `link_resent`, `email_confirmed`, and in the app `part_done`, `message_sent`, `note_written`, `answer_given`, `more_done`, `picture_changed`, `idea_declined`, `explore_go`.
- Every event carries `in: true` when the person is signed in.

The screens, in order: `opener`, `name`, `stack_tap`, `stack_list`, `number`, `study_feed`, `study_keep`, `study_day`, `study_reach`, `study_busy`, `study_people`, `study_read`, `reveal_wait` (the "shaping it" wait), `reveal`, `email`, `email_done`, then the app: `ritual`, `things`, `explore`, `settings`. Beside the path: `stack_talk` ("Rather talk it through?"), `connect` (the wearable, off for now) and `sign_in`.

To count something new, add it to `funnelEvents` or `screens` in `lib/funnel.ts`, then call `track()` or `useScreen()` from `lib/track.ts`. Keep it to screens, taps and small numbers; the privacy page and the App Store label (`docs/APP-STORE.md`) say that's all we collect.

## Limits

- A device is one browser. The same person on their phone and laptop is two.
- Ad blockers rarely block it (it's our own address), but a private window starts a new device every time.
- The time on a screen stops while the page is hidden, and anything over 30 minutes is left out.
- At launch volumes the page reads every event for the range at once; past about 5,000 people in a range it shows the latest 5,000.

## The same in SQL

In Supabase's SQL editor, the last screen of everyone who first arrived in the last 7 days and hasn't been seen for 30 minutes:

```sql
with people as (
  select device, min(at) as first_at, max(at) as last_at
  from public.app_events
  group by device
  having min(at) > now() - interval '7 days' and max(at) < now() - interval '30 minutes'
),
last_screen as (
  select distinct on (e.device) e.device, e.props->>'s' as screen
  from public.app_events e join people using (device)
  where e.event = 'screen'
  order by e.device, e.at desc
)
select screen, count(*) as people
from last_screen
group by screen
order by people desc;
```

The median time on each screen, last 7 days:

```sql
select props->>'prev' as screen,
  percentile_cont(0.5) within group (order by (props->>'ms')::numeric) / 1000 as median_seconds,
  count(*) as visits
from public.app_events
where event = 'screen' and props ? 'ms' and at > now() - interval '7 days'
group by 1
order by 2 desc;
```
