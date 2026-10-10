'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon } from '../../../components/icon';
import { Button, Chip, Field } from '../../../components/ui';
import { api } from '../../../lib/api';
import { copy } from '../../../lib/copy';
import { statusesAfterDayOne } from '../../../lib/data/routed';
import { useRouted } from '../../../lib/data/use-routed';
import { useProgress } from '../../../lib/progress/context';
import type { Progress } from '../../../lib/progress/types';

type Days = 14 | 28 | 42;

/**
 * The end of onboarding, after the wearable is in: the first thing to read on this person, from the
 * engine's queue. With a signed-in account it starts the experiment on the backend (the person's
 * own on and off conditions, and the test length, locked from here). Either way the sort is saved
 * and Today opens.
 */
export function FirstReading() {
  const router = useRouter();
  const { progress, update, saveNow, store } = useProgress();
  const { routed } = useRouted();
  const [days, setDays] = useState<Days>(28);
  const [onDefinition, setOnDefinition] = useState('');
  const [offDefinition, setOffDefinition] = useState('');
  const [picking, setPicking] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const live = store.id === 'supabase';
  const dayOne = progress.dayOne;

  const queue = routed?.queue ?? [];
  const first =
    queue.find((q) => q.itemKey === (dayOne.firstExperiment ?? queue[0]?.itemKey)) ?? queue[0];
  const nameOf = (key: string) => routed?.items.find((r) => r.itemKey === key)?.name ?? key;

  async function start() {
    if (!routed) return;
    setStarting(true);
    setError(null);
    const statuses = statusesAfterDayOne(routed, dayOne);
    const next: Progress = {
      ...progress,
      step: 'done',
      // The first reading's item is written down, so the demo and the verdict stay on it.
      dayOne: {
        ...dayOne,
        started: true,
        firstExperiment: dayOne.firstExperiment ?? first?.itemKey,
      },
      items: progress.items.map((i) => ({ ...i, status: statuses[i.id] ?? i.status })),
      updatedAt: new Date().toISOString(),
    };
    try {
      await saveNow(next);
      if (live && first) {
        await api('/api/app/experiments', {
          method: 'POST',
          body: JSON.stringify({
            itemKey: first.itemKey,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            days,
            onDefinition,
            offDefinition,
          }),
        });
      }
      update(next);
      router.push('/today');
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      setError(
        code.startsWith('baseline_')
          ? copy.firstReading.errorBaseline
          : code === 'experiment_already_active'
            ? copy.firstReading.errorActive
            : copy.firstReading.errorOther,
      );
    } finally {
      setStarting(false);
    }
  }

  const needsDefinitions =
    live &&
    first &&
    (!onDefinition.trim() || !offDefinition.trim() || onDefinition.trim() === offDefinition.trim());

  return (
    <div className="glass first-reading">
      <h2 className="h-small">{copy.firstReading.title}</h2>
      {first ? (
        <>
          <p className="first-name">{nameOf(first.itemKey)}</p>
          <p className="muted">{live ? copy.firstReading.lineLive : copy.firstReading.lineLocal}</p>
          {live ? <p className="muted">{copy.firstReading.lengthNote}</p> : null}
          {first.observeOnly ? <p className="muted">{copy.dayOne.observeLine}</p> : null}
          {live ? (
            <>
              <div className="field">
                <span className="field-label">{copy.firstReading.duration}</span>
                <div className="chips" role="radiogroup" aria-label={copy.firstReading.duration}>
                  {([14, 28, 42] as const).map((d) => (
                    <Chip key={d} radio selected={days === d} onClick={() => setDays(d)}>
                      {copy.firstReading.days[d]}
                    </Chip>
                  ))}
                </div>
              </div>
              <Field
                label={first.observeOnly ? copy.firstReading.onObserve : copy.firstReading.onLabel}
                value={onDefinition}
                onChange={(e) => setOnDefinition(e.target.value)}
                maxLength={1000}
              />
              <Field
                label={
                  first.observeOnly ? copy.firstReading.offObserve : copy.firstReading.offLabel
                }
                value={offDefinition}
                onChange={(e) => setOffDefinition(e.target.value)}
                maxLength={1000}
              />
              {first.observeOnly ? <p className="muted">{copy.firstReading.observeNote}</p> : null}
            </>
          ) : null}
          {queue.length > 1 ? (
            <div className="stack-tight">
              <Button variant="link" onClick={() => setPicking((p) => !p)} aria-expanded={picking}>
                {copy.dayOne.notThisOne}
              </Button>
              {picking ? (
                <div className="chips" role="radiogroup" aria-label={copy.dayOne.pickAnother}>
                  {queue.map((q) => (
                    <Chip
                      key={q.itemKey}
                      radio
                      selected={first.itemKey === q.itemKey}
                      onClick={() => {
                        update((p) => ({
                          ...p,
                          dayOne: { ...p.dayOne, firstExperiment: q.itemKey },
                        }));
                        setPicking(false);
                      }}
                    >
                      {nameOf(q.itemKey)}
                    </Chip>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : (
        <p className="muted">{copy.firstReading.none}</p>
      )}
      {error ? (
        <p className="notice" role="alert">
          {error}
        </p>
      ) : null}
      <div className="actions">
        <Button
          onClick={() => void start()}
          disabled={!routed || starting || Boolean(needsDefinitions)}
          busy={starting}
        >
          {starting
            ? copy.firstReading.starting
            : first
              ? copy.firstReading.start
              : copy.firstReading.finish}
          {starting ? null : <Icon name="arrow" size={18} />}
        </Button>
      </div>
    </div>
  );
}
