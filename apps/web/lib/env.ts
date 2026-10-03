/** Public flags. NEXT_PUBLIC_ values are inlined at build time, so each is read by its full name. */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  /** Live wearable connections stay off until the Phase 2 routes are merged and configured. */
  providersEnabled: process.env.NEXT_PUBLIC_PROVIDERS_ENABLED === 'true',
  /** Marks catalog rows flagged for a fact-check as "being checked". Off until the team signs off. */
  showUnverified: process.env.NEXT_PUBLIC_SHOW_UNVERIFIED === 'true',
};
export const supabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
