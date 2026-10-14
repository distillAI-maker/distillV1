import { z } from 'zod';

/**
 * The launch funnel, in order: how far people get. Steps and small counts only, never what anyone
 * writes and never an email (supabase/migrations/20261013000001_app_events.sql).
 */
export const funnelEvents = [
  'arrived',
  'started',
  'stack_done',
  'number_seen',
  'joined',
  'wearable',
  'no_wearable',
  'home_opened',
  'note_written',
  'answer_given',
  'more_done',
  'picture_changed',
  'idea_declined',
] as const;
export type FunnelEvent = (typeof funnelEvents)[number];

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
  .strict();
export type EventInput = z.input<typeof eventSchema>;
