import { z } from 'zod';

/**
 * What the funnel counts: the screens people reach, how long each one takes, the screen they were
 * on when they left, and a few taps. Steps, times and small counts only, never what anyone writes
 * and never an email (supabase/migrations/20261013000001_app_events.sql). docs/FUNNEL.md reads it.
 */
export const funnelEvents = [
  // Milestones, counted once per device (lib/track.ts). Older rows only have these.
  'arrived',
  'started',
  'stack_done',
  'number_seen',
  'joined',
  'wearable',
  'no_wearable',
  'home_opened',
  // Screens: one when a screen shows, and one when the page is hidden or closed on it.
  'screen',
  'left',
  // Taps in onboarding.
  'made_it_mine',
  'change_something',
  'link_sent',
  'link_failed',
  'link_resent',
  'email_confirmed',
  // Taps in the app.
  'part_done',
  'message_sent',
  'note_written',
  'answer_given',
  'more_done',
  'picture_changed',
  'idea_declined',
  'explore_go',
] as const;
export type FunnelEvent = (typeof funnelEvents)[number];

type Part = 'onboarding' | 'app' | 'side';

/**
 * Every screen, in the order onboarding shows them, then the app. `branch` screens sit beside the
 * path (not everyone sees them), so the funnel lists them apart. The study's seven screens share
 * one page, as do the stack's three ways in, and each still counts as its own screen.
 */
export const screens = [
  { id: 'opener', label: 'Opener', part: 'onboarding' },
  { id: 'name', label: 'Name', part: 'onboarding' },
  { id: 'stack_tap', label: 'Stack: tap what you do', part: 'onboarding' },
  { id: 'stack_talk', label: 'Stack: talk it through', part: 'onboarding', branch: true },
  { id: 'stack_list', label: 'Stack: your list', part: 'onboarding' },
  { id: 'number', label: 'The number', part: 'onboarding' },
  { id: 'study_feed', label: 'Study 1: from social media', part: 'onboarding' },
  { id: 'study_keep', label: 'Study 2: never give up', part: 'onboarding' },
  { id: 'study_day', label: 'Study 3: a normal day', part: 'onboarding' },
  { id: 'study_reach', label: 'Study 4: what you reach for', part: 'onboarding' },
  { id: 'study_busy', label: 'Study 5: what goes first', part: 'onboarding' },
  { id: 'study_people', label: 'Study 6: more time with', part: 'onboarding' },
  { id: 'study_read', label: 'Study 7: the read', part: 'onboarding' },
  { id: 'reveal_wait', label: 'Reveal: shaping it', part: 'onboarding' },
  { id: 'reveal', label: 'Reveal: your Ritual', part: 'onboarding' },
  { id: 'email', label: 'Email', part: 'onboarding' },
  { id: 'email_done', label: "Email: you're in", part: 'onboarding' },
  { id: 'connect', label: 'Wearable', part: 'onboarding', branch: true },
  { id: 'ritual', label: 'Ritual', part: 'app' },
  { id: 'things', label: 'Your things', part: 'app' },
  { id: 'explore', label: 'Explore', part: 'app' },
  { id: 'settings', label: 'Settings', part: 'app' },
  { id: 'sign_in', label: 'Sign in', part: 'side' },
] as const satisfies readonly { id: string; label: string; part: Part; branch?: boolean }[];
export type ScreenId = (typeof screens)[number]['id'];

export const screenIds = screens.map((s) => s.id) as [ScreenId, ...ScreenId[]];
const known = new Set<string>(screenIds);
export const isScreen = (s: unknown): s is ScreenId => typeof s === 'string' && known.has(s);

/** The study's seven screens, by their place on the page (app/(study)/study/study.tsx). */
export const studyScreens = [
  'study_feed',
  'study_keep',
  'study_day',
  'study_reach',
  'study_busy',
  'study_people',
  'study_read',
] as const satisfies readonly ScreenId[];

/** Longest stretch on one screen worth keeping; past it they were away, not reading. */
export const MAX_SCREEN_MS = 30 * 60_000;

export const eventSchema = z
  .object({
    event: z.enum(funnelEvents),
    device: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
    source: z
      .string()
      .regex(/^[A-Za-z0-9_.-]{1,40}$/)
      .optional(),
    props: z
      .record(z.string().max(24), z.union([z.string().max(40), z.number().finite(), z.boolean()]))
      .refine((p) => Object.keys(p).length <= 8)
      .default({}),
  })
  .strict()
  .refine(
    ({ event, props }) => {
      if (event !== 'screen' && event !== 'left') return true;
      const { s, prev, ms } = props as Record<string, unknown>;
      if (!isScreen(s)) return false;
      if (prev !== undefined && !isScreen(prev)) return false;
      return ms === undefined || (typeof ms === 'number' && ms >= 0 && ms <= MAX_SCREEN_MS);
    },
    { message: 'A screen needs a known screen id, and a time within reason' },
  );
export type EventInput = z.input<typeof eventSchema>;
