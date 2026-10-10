'use client';

import { Icon } from '../../../components/icon';
import { Button, Chip } from '../../../components/ui';
import { copy } from '../../../lib/copy';

export type PersonKind = 'doctor' | 'keep';

/** The two questions about the person's own stack, asked once, before the item follow-ups. */
export function PersonQuestion({
  kind,
  options,
  selected,
  count,
  onToggle,
  onNone,
  onContinue,
}: {
  kind: PersonKind;
  options: { id: string; name: string }[];
  selected: Set<string>;
  count: { k: number; n: number };
  onToggle: (id: string) => void;
  onNone?: () => void;
  onContinue: () => void;
}) {
  const title = kind === 'doctor' ? copy.person.doctorQ : copy.person.keepQ;
  return (
    <section className="stack screen-question">
      <div className="q-progress" aria-hidden="true">
        {Array.from({ length: count.n }, (_, i) => (
          <span key={i} className={i < count.k ? 'on' : ''} />
        ))}
      </div>
      <h1>{title}</h1>
      <div className="answers" role="group" aria-label={title}>
        {options.map((o) => (
          <Chip key={o.id} selected={selected.has(o.id)} onClick={() => onToggle(o.id)}>
            <span>{o.name}</span>
            <b aria-hidden="true">{selected.has(o.id) ? '✓' : ''}</b>
          </Chip>
        ))}
        {onNone ? (
          <Chip selected={selected.size === 0} onClick={onNone}>
            <span>{copy.person.none}</span>
            <b aria-hidden="true">{selected.size === 0 ? '✓' : ''}</b>
          </Chip>
        ) : null}
      </div>
      <div className="actions">
        <Button onClick={onContinue}>
          {copy.common.continue}
          <Icon name="arrow" size={18} />
        </Button>
      </div>
    </section>
  );
}
