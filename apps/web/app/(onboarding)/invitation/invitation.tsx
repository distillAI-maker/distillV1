'use client';

import { useRouter } from 'next/navigation';
import { useGo } from '../../../components/onboarding/go';
import { Mark } from '../../../components/onboarding/mark';
import { Icon } from '../../../components/icon';
import { Button, Skeleton } from '../../../components/ui';
import { copy } from '../../../lib/copy';
import { useRouted } from '../../../lib/data/use-routed';
import { useProgress } from '../../../lib/progress/context';

const money = (n: number) => Math.round(n).toLocaleString('en-US');

/**
 * The invitation, as the Figma build drew it, with no price in the app: founding membership is
 * free while we build it. Joining opens the private reading; the next step is the wearable.
 */
export function Invitation() {
  const go = useGo();
  const router = useRouter();
  const { progress, update } = useProgress();
  const { routed, summary } = useRouted();
  if (!routed || !summary)
    return (
      <section className="stack" aria-busy="true">
        <Skeleton kind="title" count={2} />
      </section>
    );

  const first = routed.queue[0];
  const firstName = first ? routed.items.find((r) => r.itemKey === first.itemKey)?.name : undefined;
  const member = progress.member;

  return (
    <div className="invitation">
      <section className="invite-hero">
        <div className="orbit" aria-hidden="true">
          <Mark />
        </div>
        <p className="eyebrow">{copy.invitation.eyebrow}</p>
        <h1>{copy.invitation.title}</h1>
        <ul className="invite-lines">
          {copy.invitation.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>

      <section className="inverse report" aria-label={copy.invitation.reportHead}>
        <div className="report-head">
          <span>{copy.invitation.reportHead}</span>
          <span className="num">{copy.invitation.reportNo}</span>
        </div>
        <p className="report-title">{copy.invitation.reportTitle}</p>
        <div className="brass-rule" aria-hidden="true" />
        <dl className="report-grid">
          <div>
            <dt>{copy.invitation.essentials}</dt>
            <dd>{summary.count}</dd>
          </div>
          <div>
            <dt>{copy.invitation.release}</dt>
            <dd>{String(summary.dropsToday).padStart(2, '0')}</dd>
          </div>
          <div>
            <dt>{copy.invitation.back}</dt>
            <dd>${money(summary.monthlyBack)}</dd>
          </div>
        </dl>
        {firstName ? <p className="report-first">{copy.invitation.firstUp(firstName)}</p> : null}
        <p className="report-quote">“{copy.invitation.quote}”</p>
        <div className="report-manifesto">
          {copy.invitation.manifesto.map((m) => (
            <p key={m}>{m}</p>
          ))}
        </div>
        <div className="report-seal">
          <Mark />
          <span>{copy.invitation.seal}</span>
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
            <p className="joined-title">{copy.invitation.joined}</p>
            <p className="muted">{copy.invitation.joinedLine}</p>
            <div className="actions">
              <Button onClick={() => go('connect')}>
                {copy.invitation.connect}
                <Icon name="arrow" size={18} />
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="join-price">{copy.invitation.free}</p>
            <p className="muted join-line">{copy.invitation.freeLine}</p>
            <div className="actions">
              <Button onClick={() => update({ member: true })}>
                {copy.invitation.begin}
                <Icon name="arrow" size={18} />
              </Button>
              <Button variant="link" onClick={() => router.push('/ready')}>
                {copy.invitation.notYet}
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
