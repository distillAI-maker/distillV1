'use client';

import { useState } from 'react';
import { useGo } from '../../../components/onboarding/go';
import { Mark } from '../../../components/onboarding/mark';
import { Icon } from '../../../components/icon';
import { Button, Field, Skeleton } from '../../../components/ui';
import { copy } from '../../../lib/copy';
import { useRouted } from '../../../lib/data/use-routed';
import { useProgress } from '../../../lib/progress/context';
import { requestMagicLink } from '../../sign-in/actions';

const money = (n: number) => Math.round(n).toLocaleString('en-US');
const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

type Link = { state: 'idle' } | { state: 'sent'; email: string } | { state: 'failed' };

/**
 * The invitation, as the Figma build drew it, with no price in the app: founding membership is
 * free while we build it. With accounts switched on, this is where the email is asked; joining
 * opens the private reading and sends a sign-in link that keeps it. The next step is the wearable.
 */
export function Invitation({ accounts = false }: { accounts?: boolean }) {
  const go = useGo();
  const { progress, update, saveNow } = useProgress();
  const { routed, summary } = useRouted();
  const [email, setEmail] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<Link>({ state: 'idle' });
  if (!routed || !summary)
    return (
      <section className="stack" aria-busy="true">
        <Skeleton kind="title" count={2} />
      </section>
    );

  const member = progress.member;

  async function join() {
    setProblem(null);
    if (!accounts) return update({ member: true });
    if (!looksLikeEmail(email)) return setProblem(copy.invitation.emailError);
    setBusy(true);
    const next = { ...progress, member: true, updatedAt: new Date().toISOString() };
    try {
      // Saved on this device first, so the sign-in link carries it into the account.
      await saveNow(next);
      update({ member: true });
      const form = new FormData();
      form.set('email', email.trim());
      const sent = await requestMagicLink({ status: 'idle', email: '' }, form);
      setLink(sent.status === 'sent' ? { state: 'sent', email: sent.email } : { state: 'failed' });
    } catch {
      update({ member: true });
      setLink({ state: 'failed' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="invitation">
      <section className="invite-hero">
        <div className="orbit" aria-hidden="true">
          <Mark />
        </div>
        <h1>{copy.invitation.title}</h1>
        <p className="invite-line">{copy.invitation.line}</p>
      </section>

      <section className="inverse report" aria-label={copy.invitation.reportTitle}>
        <p className="report-title">{copy.invitation.reportTitle}</p>
        <div className="brass-rule" aria-hidden="true" />
        <dl className="report-grid">
          <div>
            <dt>{copy.invitation.essentials}</dt>
            <dd>{summary.count}</dd>
          </div>
          <div>
            <dt>{copy.invitation.monthly}</dt>
            <dd>${money(summary.monthlyTotal)}</dd>
          </div>
        </dl>
        <p className="report-quote">“{copy.invitation.quote}”</p>
        <div className="report-manifesto">
          {copy.invitation.manifesto.map((m) => (
            <p key={m}>{m}</p>
          ))}
        </div>
      </section>

      <section className="inverse includes">
        <h2 className="h-label">{copy.invitation.includesTitle}</h2>
        <ul>
          {copy.invitation.includes.map((b) => (
            <li key={b.label}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3 8l3.5 3.5L13 4.5" />
              </svg>
              <div>
                <p className="inc-label">{b.label}</p>
                <p className="inc-detail">{b.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="join" aria-live="polite">
        {member ? (
          <div className="joined">
            <div className="joined-mark" aria-hidden="true">
              <Mark />
            </div>
            <p className="joined-title">
              {progress.name.trim()
                ? copy.invitation.joinedNamed(progress.name.trim())
                : copy.invitation.joined}
            </p>
            <p className="muted">
              {link.state === 'sent'
                ? copy.invitation.linkSent(link.email)
                : link.state === 'failed'
                  ? copy.invitation.linkFailed
                  : copy.invitation.joinedLine}
            </p>
            <div className="actions">
              <Button onClick={() => go('connect')}>
                {copy.invitation.connect}
                <Icon name="arrow" size={18} />
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="join-form"
            onSubmit={(e) => {
              e.preventDefault();
              void join();
            }}
          >
            <p className="join-price">{copy.invitation.free}</p>
            <p className="muted join-line">{copy.invitation.freeLine}</p>
            {accounts ? (
              <Field
                label={copy.invitation.emailLabel}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={copy.invitation.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={problem ?? undefined}
              />
            ) : null}
            <div className="actions">
              <Button type="submit" busy={busy}>
                {copy.invitation.begin}
                <Icon name="arrow" size={18} />
              </Button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
