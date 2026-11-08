/**
 * Who can open the funnel page (app/team): the addresses in TEAM_EMAILS, comma-separated, set in
 * Vercel. Nobody when it's unset, and only a confirmed email, so the page fails closed.
 */
export function isTeam(
  user: { email?: string | null; email_confirmed_at?: string | null } | null | undefined,
  list = process.env.TEAM_EMAILS,
): boolean {
  const email = user?.email?.trim().toLowerCase();
  if (!email || !user?.email_confirmed_at || !list) return false;
  return list
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .includes(email);
}
