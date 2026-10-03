import { copy } from '../lib/copy';
import type { Night } from '../lib/data/types';

/** Fourteen squares, three on and three off, with today outlined and unknown taps dashed. */
export function DayStrip({ nights, today, onLabel, offLabel }: { nights: Night[]; today: number; onLabel: string; offLabel: string }) {
  return (
    <div className="stack-tight">
      <div className="days" role="list" aria-label={copy.today.stripLabel}>
        {nights.map((n, i) => {
          const tapped = i < today ? copy.today.taps[n.tap] : i === today ? copy.today.taps[n.tap === 'unknown' ? 'none' : n.tap] : copy.today.taps.none;
          const cls = [
            n.condition === 'on' ? 'on' : '',
            i === today ? 'now' : '',
            i < today && n.tap === 'unknown' ? 'unknown' : '',
            !n.counted ? 'out' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <i key={n.date} className={cls} role="listitem" aria-label={copy.today.dayLabel(i + 1, n.condition, tapped)}>
              {i + 1}
            </i>
          );
        })}
      </div>
      <div className="key" aria-hidden="true">
        <span>
          <i />
          {onLabel}
        </span>
        <span>
          <i className="off" />
          {offLabel}
        </span>
      </div>
    </div>
  );
}
