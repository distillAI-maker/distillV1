'use client';

import { useGo } from '../../../components/onboarding/go';
import { Icon } from '../../../components/icon';
import { Button, Skeleton } from '../../../components/ui';
import { copy } from '../../../lib/copy';
import { useRouted } from '../../../lib/data/use-routed';
import { useProgress } from '../../../lib/progress/context';

function excerpt(text: string, max = 260): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (clean.length <= max) return clean;
  const cut = clean.lastIndexOf(' ', max);
  return `${clean.slice(0, cut > 0 ? cut : max)}…`;
}

function listOf(items: string[]): string {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * The letter. It only repeats what the person typed and picked: their own words, and what they said
 * they'd never give up. Nothing in it is a claim about who they are.
 */
export function Heard() {
  const go = useGo();
  const { ready, progress } = useProgress();
  const { routed } = useRouted();
  if (!ready)
    return (
      <section className="stack" aria-busy="true">
        <Skeleton kind="title" count={2} />
      </section>
    );

  const nameById = new Map((routed?.items ?? []).map((r) => [r.stackItemId, r.name]));
  const keep = progress.dayOne.yours.map((id) => nameById.get(id)).filter((n): n is string => Boolean(n));
  const words = excerpt(progress.lifeText);

  return (
    <article className="letter">
      <div className="folio">
        <span>{copy.heard.prepared}</span>
        <span className="num">{copy.heard.private}</span>
      </div>
      <p className="eyebrow">{copy.heard.eyebrow}</p>
      <h1 className="letter-title">{copy.heard.title}</h1>
      <div className="brass-rule" aria-hidden="true" />
      {words ? (
        <blockquote className="letter-copy letter-quote">
          <p>“{words}”</p>
        </blockquote>
      ) : (
        <p className="letter-copy">{copy.heard.blank}</p>
      )}
      {keep.length ? (
        <>
          <p className="letter-copy">{copy.heard.keepLine(listOf(keep))}</p>
          <p className="letter-emphasis">{copy.heard.keepPromise}</p>
          <div className="best">
            <p className="best-label">{copy.heard.yoursLabel}</p>
            <ol>
              {keep.map((name, i) => (
                <li key={name}>
                  <span className="num">{String(i + 1).padStart(2, '0')}</span>
                  <p>{name}</p>
                </li>
              ))}
            </ol>
          </div>
        </>
      ) : (
        <p className="letter-emphasis">{copy.heard.noneKept}</p>
      )}
      <div className="actions">
        <Button onClick={() => go('sorted')}>
          {copy.heard.next}
          <Icon name="arrow" size={18} />
        </Button>
      </div>
    </article>
  );
}
