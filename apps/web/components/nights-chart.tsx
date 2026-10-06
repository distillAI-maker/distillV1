'use client';

import { useId, useState } from 'react';
import { copy } from '../lib/copy';
import type { Night } from '../lib/data/types';

/**
 * The 14 nights behind a verdict, as on the landing page: one dot a night, filled for the
 * on-nights, with the two averages as lines. Every dot is focusable and named for a screen reader.
 */
export function NightsChart({ nights, unit, onLabel }: { nights: Night[]; unit: string; onLabel: string }) {
  const id = useId();
  const [tip, setTip] = useState<string | null>(null);
  const values = nights.map((n) => n.value).filter((v): v is number => v !== null);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.25 || 10;
  const yMin = lo - pad;
  const yMax = hi + pad;
  const W = 560;
  const H = 200;
  const left = 8;
  const step = (W - left * 2) / nights.length;
  const y = (v: number) => H - 24 - ((v - yMin) / (yMax - yMin)) * (H - 44);
  const mean = (cond: 'on' | 'off') => {
    const xs = nights.filter((n) => n.condition === cond && n.counted && n.value !== null).map((n) => n.value as number);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };
  const onMean = mean('on');
  const offMean = mean('off');
  const label = (n: Night, k: number) =>
    n.value === null
      ? copy.verdict.nightMissing(k, n.condition)
      : copy.verdict.night(k, n.condition, copy.verdict.unit(Math.round(n.value), unit), copy.today.taps[n.tap]);

  return (
    <figure className="chart" aria-labelledby={`${id}-t`}>
      <div className="k">
        <span id={`${id}-t`}>{copy.verdict.chartTitle}</span>
        <span>
          <i />
          {onLabel}
        </span>
        <span>
          <i className="off" />
          {copy.verdict.chartOff}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={copy.verdict.chartTitle}>
        {onMean !== null ? (
          <line x1={left} x2={W - left} y1={y(onMean)} y2={y(onMean)} stroke="var(--accent)" strokeWidth={1.5} />
        ) : null}
        {offMean !== null ? (
          <line
            x1={left}
            x2={W - left}
            y1={y(offMean)}
            y2={y(offMean)}
            stroke="var(--muted)"
            strokeWidth={1.5}
            strokeDasharray="6 5"
          />
        ) : null}
        {nights.map((n, i) => {
          const cx = left + step * i + step / 2;
          const text = label(n, i + 1);
          return (
            <g key={n.date}>
              <text x={cx} y={H - 6} textAnchor="middle" fontSize="11" fontFamily="var(--mono)" fill="var(--muted)">
                {i + 1}
              </text>
              {n.value !== null ? (
                <circle
                  cx={cx}
                  cy={y(n.value)}
                  r={n.condition === 'on' ? 7 : 6}
                  fill={n.condition === 'on' ? 'var(--accent)' : 'var(--bg)'}
                  stroke={n.condition === 'on' ? 'var(--accent)' : 'var(--muted)'}
                  strokeWidth={1.5}
                  opacity={n.counted ? 1 : 0.35}
                  tabIndex={0}
                  role="img"
                  aria-label={text}
                  onMouseEnter={() => setTip(text)}
                  onMouseLeave={() => setTip(null)}
                  onFocus={() => setTip(text)}
                  onBlur={() => setTip(null)}
                  onClick={() => setTip(text)}
                >
                  <title>{text}</title>
                </circle>
              ) : null}
            </g>
          );
        })}
      </svg>
      <p className="tip" aria-live="polite">
        {tip ?? copy.verdict.chartHint}
      </p>
      <figcaption className="muted" style={{ fontSize: 13 }}>
        {copy.verdict.chartLines}
      </figcaption>
    </figure>
  );
}
