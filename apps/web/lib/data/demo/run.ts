import type { Item } from '@distill/catalog';
import { routeStack } from '@distill/engine';
import type { InventoryItem, RoutedItem, StackAnswers } from '@distill/engine';
import {
  createSchedule,
  measurement,
  metricFields,
  planBaseline,
  recordCheckIn,
  startExperiment,
} from '@distill/engine/experiment';
import type { CheckIn, Exclusion, HistoricalNight, PreRegistration } from '@distill/engine/experiment';
import { analyzeExperiment, experimentResultCard, estimateV2 } from '@distill/engine/stats';
import { renderExperimentVerdict, roundMeasurement } from '@distill/engine/verdict';
import { catalog } from '../../catalog/server';
import type { Progress } from '../../progress/types';
import { answersFor } from '../engine';
import { demoEffectFor, shiftDate, syntheticNights } from '../synthetic';
import type { Experiment, Night, Verdict } from '../types';
import { demoExperimentId, demoItemKey, demoInstructions } from './experiments';

/**
 * The signed-out demo, run through the real engine: a synthetic person from the simulation
 * generator, the real registration, the person's own taps, the real analysis and the real
 * verdict sentences. Nothing here decides anything; it only feeds the engine and shapes its
 * answer for the screens. The fortnight is already behind the person, so today is day 14; each
 * "skip ahead a week" moves to the next read (day 21, then 28), exactly as a live test would.
 *
 * Server only: the catalog is a megabyte and the generator pulls in the provider parsers. The
 * browser reaches this through the two actions in `./actions.ts`.
 */

const seed = 20260928;
const channel = { source: 'synthetic' as const, deviceModel: 'Synthetic demo' };
const looks = estimateV2.looks;
const items = new Map<string, Item>(catalog.items.map((i) => [i.key, i]));
const lowerIsBetter = new Set(['sleepLatencyMinutes', 'wakeAfterSleepOnsetMinutes', 'restingHeartRateBpm']);

/** The person's whole stack through the engine, so overlaps and goals apply as they did on day one. */
function routeProgress(progress: Progress): RoutedItem[] {
  const known = progress.items.filter((s) => s.itemKey && items.has(s.itemKey));
  const inventory: InventoryItem[] = known.map((s) => ({
    id: s.id,
    key: s.itemKey!,
    name: items.get(s.itemKey!)?.name,
    monthlyCost: Number.isFinite(s.monthlyCost) ? Math.max(0, s.monthlyCost) : 0,
  }));
  const answers: Record<string, StackAnswers> = {};
  for (const s of known) answers[s.id] = answersFor(s, items.get(s.itemKey!), progress);
  try {
    return [...routeStack(inventory, answers).runnable];
  } catch {
    return [];
  }
}
/**
 * The item the demo runs: the one recorded when the first reading started (whatever has happened
 * to it since, so a verdict acted on stays the same verdict), else the first item under test,
 * else the one the person already decided, else the engine's first, else coffee.
 */
function chosenCandidate(progress: Progress): RoutedItem {
  const runnable = routeProgress(progress);
  const status = new Map(progress.items.map((s) => [s.id, s.status]));
  const decided = Boolean(progress.verdictChoices[demoExperimentId]);
  const picked =
    runnable.find((r) => r.key === progress.dayOne.firstExperiment) ??
    runnable.find((r) => status.get(r.id) === 'testing') ??
    (decided ? runnable.find((r) => ['cut', 'kept'].includes(status.get(r.id) ?? '')) : undefined) ??
    runnable[0];
  if (picked) return picked;
  return routeStack([{ id: 'demo', key: demoItemKey, monthlyCost: 0 }], {
    demo: { goal: 'sleep', time: '2 to 5pm' },
  }).runnable[0]!;
}

function localDate(now: Date): string {
  const d = new Date(now);
  d.setHours(12, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

interface DemoWorld {
  readonly startDate: string;
  readonly registration: PreRegistration;
  readonly history: HistoricalNight[];
  readonly name: string;
  readonly key: string;
  readonly monthlyCost: number;
  readonly observe: boolean;
}
const worlds = new Map<string, DemoWorld>();
/** Built once per start date and item: the schedule, the person and the locked registration. */
function world(now: Date, progress: Progress): DemoWorld {
  // The Monday at least thirteen days ago, so that the first read (day 14) is today or just past.
  let startDate = shiftDate(localDate(now), -13);
  while (weekday(startDate) !== 1) startDate = shiftDate(startDate, -1);
  const candidate = chosenCandidate(progress);
  const cacheKey = `${startDate}:${candidate.key}`;
  const cached = worlds.get(cacheKey);
  if (cached) return cached;
  const observe = candidate.onDays === 'observe';
  const config = {
    totalDays: looks.at(-1)!,
    minimumNightsPerSide: 5,
    dropFirstNightOfBlock: false,
    balancedPrefixDays: [looks[0]!],
  };
  const schedule = createSchedule(startDate, seed, observe, config);
  const metric = metricFields[candidate.metric!]!;
  const direction = lowerIsBetter.has(metric) ? 'lower' : 'higher';
  const history = syntheticNights({
    through: schedule.days.at(-1)!.sleepDate,
    seedText: `demo-${candidate.key}`,
    effect: demoEffectFor(
      candidate,
      metric,
      direction,
      schedule.days.filter((d) => d.condition !== 'off').map((d) => d.sleepDate),
    ),
  });
  // HRV measurements only count on a channel that names the method the device uses.
  const chan = metric === 'overnightHrvMs' ? { ...channel, hrvMethod: 'rmssd' as const } : channel;
  const baseline = planBaseline(history, metric, chan, startDate, startDate);
  const lines = demoInstructions[candidate.key] ?? {
    on: `${candidate.name}, as you usually would.`,
    off: `No ${candidate.name.toLowerCase()} tonight.`,
  };
  const registration = startExperiment({
    experimentId: demoExperimentId,
    cycleId: 'demo-cycle',
    candidate,
    baseline,
    lockedAt: `${startDate}T12:00:00Z`,
    timeZone: 'UTC',
    seed,
    direction,
    onDefinition: lines.on,
    offDefinition: lines.off,
  });
  const built = {
    startDate,
    registration,
    history,
    name: candidate.name,
    key: candidate.key,
    monthlyCost: candidate.monthlyCost ?? 0,
    observe,
  };
  worlds.set(cacheKey, built);
  return built;
}
const exclusionFor = (label: string | undefined): Exclusion[] => {
  if (!label) return [];
  const flags: Record<string, Exclusion> = {
    Ill: 'ill',
    Travelling: 'travelling',
    'Kids woke me': 'kids_woke_me',
    'Unusually hard session': 'unusually_hard_session',
  };
  return [flags[label] ?? 'travelling'];
};
function stage(progress: Progress): number {
  return Math.max(0, Math.min(looks.length - 1, progress.demoSkipDays ?? 0));
}
/**
 * Check-ins: every past night tapped "did" unless the person tapped otherwise; tonight only if
 * they tapped. For an observed item "did" means it happened, so the night is recorded as on.
 */
function checkInsFor(w: DemoWorld, progress: Progress, through: string): CheckIn[] {
  const own = progress.taps[demoExperimentId] ?? {};
  return w.registration.schedule.days
    .filter((d) => d.sleepDate <= through)
    .flatMap((d) => {
      const mine = own[d.sleepDate];
      const tap = mine?.value ?? (d.sleepDate < through ? 'did' : undefined);
      if (!tap) return [];
      const exclusions = exclusionFor(mine?.excluded);
      if (w.observe) {
        if (tap === 'unknown') return [recordCheckIn(w.registration, { sleepDate: d.sleepDate, exclusions })];
        // Untapped past nights follow the person's usual pattern; a tap says what actually happened.
        const happened = mine ? tap === 'did' : d.condition === 'observe';
        return [
          recordCheckIn(w.registration, {
            sleepDate: d.sleepDate,
            exposure: happened ? 'on' : 'off',
            exclusions,
          }),
        ];
      }
      return [
        recordCheckIn(w.registration, {
          sleepDate: d.sleepDate,
          ...(tap === 'unknown' ? {} : { tap }),
          exclusions,
        }),
      ];
    });
}
/** An observed night is recorded as what happened (on or off); the screens show it as the tap it was. */
function tapOf(check: CheckIn | undefined): Night['tap'] {
  if (!check) return 'unknown';
  if (check.tap !== 'unknown') return check.tap;
  return check.exposure === 'on' ? 'did' : check.exposure === 'off' ? 'didnt' : 'unknown';
}
function build(progress: Progress, now: Date) {
  const w = world(now, progress);
  const s = stage(progress);
  const horizon = looks[s]!;
  const days = w.registration.schedule.days;
  const through = days[horizon - 1]!.sleepDate;
  const checkIns = checkInsFor(w, progress, through);
  const analysis = analyzeExperiment({
    registration: w.registration,
    nights: w.history,
    checkIns,
    through,
    bootstrap: { enabled: false },
  });
  const card = experimentResultCard(analysis);
  const byDate = new Map(checkIns.map((c) => [c.sleepDate, c]));
  // Nights the analysis set aside (the night after an observed on-night carries over) are not counted.
  const setAside = new Set(analysis.excluded.map((e) => e.sleepDate));
  const nights: Night[] = days.slice(0, horizon).map((d) => {
    const night = w.history.find((h) => h.night.sleepDate === d.sleepDate);
    const check = byDate.get(d.sleepDate);
    return {
      date: d.sleepDate,
      condition: d.condition === 'off' ? 'off' : 'on',
      value: night ? measurement(night, w.registration.metric, w.registration.channel) : null,
      tap: tapOf(check),
      counted: Boolean(check?.usable) && !setAside.has(d.sleepDate),
    };
  });
  const tonightTapped = Boolean(byDate.get(through));
  const decisive = analysis.verdict !== 'Inconclusive';
  const complete = Boolean(analysis.look?.complete);
  const status: 'in_progress' | 'ready' | 'extend' = !tonightTapped
    ? 'in_progress'
    : decisive || complete
      ? 'ready'
      : 'extend';
  return { w, analysis, card, nights, through, horizon, status, checkIns, decisive, complete };
}

export async function demoExperiments(progress: Progress, now: Date): Promise<Experiment[]> {
  if (!progress.dayOne.started) return [];
  const started =
    progress.items.some((i) => i.status === 'testing') ||
    Boolean(progress.verdictChoices[demoExperimentId]);
  if (!started) return [];
  const b = build(progress, now);
  const r = b.w.registration;
  const today = r.schedule.days[b.horizon - 1]!;
  const exp: Experiment = {
    id: demoExperimentId,
    itemKey: b.w.key,
    name: b.w.name,
    status: b.status === 'ready' ? 'done' : 'running',
    startDate: b.w.startDate,
    days: b.horizon,
    maxDays: r.schedule.totalDays,
    plannedDays: r.decision?.plannedDays ?? looks[0]!,
    decision: {
      status: b.status,
      outcome: b.analysis.outcome,
      nextLook: b.analysis.look?.next ?? null,
      chanceHelps: b.card.chance?.helps ?? null,
    },
    schedule: b.nights.map((n) => n.condition),
    observeOnly: b.w.observe,
    metric: r.metricName,
    unit: b.card.unit,
    direction: 'worse',
    prereg: {
      metric: r.metricName,
      direction: 'worse',
      alpha: r.alpha,
      swing: b.card.swing?.value ?? r.personalSwing.value,
      schedule: b.nights.map((n) => n.condition),
      lockedAt: r.lockedAt,
    },
    instruction: { on: r.onDefinition, off: r.offDefinition },
    // An observed schedule marks its on-nights 'observe', not 'on'.
    instructionForToday: today.condition === 'off' ? r.offDefinition : r.onDefinition,
    monthlyCost: b.w.monthlyCost,
    monthsIn: progress.dayOne.months ?? 8,
    nights: b.nights,
    synthetic: true,
    canFinish: false,
  };
  return [exp];
}

export async function demoVerdicts(progress: Progress, now: Date): Promise<Verdict[]> {
  const [exp] = await demoExperiments(progress, now);
  if (!exp || exp.status !== 'done') return [];
  const b = build(progress, now);
  const origin = progress.items.find((i) => i.itemKey === b.w.key)?.origin;
  const narrative = renderExperimentVerdict(b.analysis, {
    itemName: b.w.name,
    subject: 'item',
    monthlyCost: b.w.monthlyCost,
    monthsUsed: progress.dayOne.months ?? 8,
    source: origin === 'doctor' || origin === 'blood test' ? undefined : origin,
    dropsCharge: b.w.monthlyCost > 0,
  });
  const card = b.card;
  const verdict: Verdict = {
    id: demoExperimentId,
    experimentId: demoExperimentId,
    itemKey: b.w.key,
    name: b.w.name,
    word: card.word,
    templateName: narrative.status === 'ready' ? (narrative.templateId ?? 'contextual') : 'needs_review',
    text: narrative.text ?? 'This result needs review before a recommendation can be shown.',
    metric: b.w.registration.metricName,
    unit: card.unit,
    // The change is read in the swing's own unit: percent for HRV, the metric's unit otherwise.
    change: card.number
      ? card.percentChange !== null
        ? roundMeasurement(card.percentChange, 'percent')
        : roundMeasurement(card.number.change, card.unit)
      : null,
    changeUnit: card.percentChange !== null ? 'percent' : card.unit,
    swing: card.swing ? roundMeasurement(card.swing.value, card.swing.unit) : null,
    swingUnit: card.swing?.unit,
    synthetic: true,
    reasons: [...card.reasons],
    nights: b.nights,
    // Every morning the person answered, whichever way the night was recorded.
    effort: {
      days: b.horizon,
      taps: b.checkIns.filter((c) => c.tap !== 'unknown' || c.exposure !== 'unknown').length,
    },
    monthlyCost: b.w.monthlyCost,
    decidedAt: b.through,
    outcome: card.outcome ?? undefined,
    chanceHelps: card.chance?.helps,
    likelyRange: card.likelyRange
      ? {
          lower: roundMeasurement(card.likelyRange.lower, card.likelyRange.unit),
          upper: roundMeasurement(card.likelyRange.upper, card.likelyRange.unit),
          unit: card.likelyRange.unit,
        }
      : undefined,
  };
  return [verdict];
}
