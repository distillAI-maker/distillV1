import { routeStack } from '@distill/engine';
import {
  planBaseline,
  recordCheckIn,
  startExperiment,
  createSchedule,
} from '@distill/engine/experiment';
import { analyzeExperiment, experimentResultCard } from '@distill/engine/stats';
import { renderExperimentVerdict, renderAuditVerdict } from '@distill/engine/verdict';
import type { PreRegistration, CheckIn } from '@distill/engine/experiment';
import type { AnalysisResult } from '@distill/engine/stats';
import { workedAnswers, workedInventory } from '../../engine/src/route/worked-example.js';
import { addDays, assertDate, immutable, nextMonday } from '../../engine/src/experiment/utils.js';
import { generatePerson } from './generator.js';
import type { SyntheticPerson } from './generator.js';
import { assertSeed, deriveSeed } from './random.js';

export const demoProfiles = [
  { id: '60000000-0000-4000-8000-000000000001', name: 'Alex', effect: 1.2 },
  { id: '60000000-0000-4000-8000-000000000002', name: 'Sam', effect: -1.2 },
  { id: '60000000-0000-4000-8000-000000000003', name: 'Jordan', effect: 0 },
] as const;
export const demoScheduleConfig = immutable({
  totalDays: 42,
  blockLengths: Array<number>(14).fill(3),
});
function fixtureUuid(label: string) {
  const hex = Array.from({ length: 4 }, (_, i) =>
    deriveSeed(20261003, `${label}:${i}`).toString(16).padStart(8, '0'),
  ).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
export interface DemoUser {
  readonly version: 1;
  readonly synthetic: true;
  readonly userId: string;
  readonly name: string;
  readonly asOf: string;
  readonly from: string;
  readonly to: string;
  readonly seed: number;
  readonly injectedEffect: number;
  readonly person: SyntheticPerson;
  readonly inventory: typeof workedInventory;
  readonly answers: typeof workedAnswers;
  readonly audit: ReturnType<typeof routeStack>;
  readonly registration: PreRegistration;
  readonly checkIns: readonly CheckIn[];
  readonly analysis: AnalysisResult;
}
export function sixMonthsBefore(value: string): string {
  assertDate(value);
  const date = new Date(value),
    day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - 6);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date.toISOString().slice(0, 10);
}
export function createDemoUsers(asOf: string, seed = 20261003): readonly DemoUser[] {
  assertDate(asOf);
  assertSeed(seed);
  const to = addDays(asOf, 1),
    from = sixMonthsBefore(to);
  const startDate = nextMonday(addDays(asOf, -49));
  const inventory = workedInventory.map((item) =>
    item.id === 'oura'
      ? { ...item, key: 'demo-sleep-data', name: 'Demo sleep data', monthlyCost: 0 }
      : { ...item },
  );
  // Preserve the worked-example ambiguities; demo fixtures do not waive source acceptance.
  const answers = structuredClone(workedAnswers);
  const audit = routeStack(inventory, answers);
  const coffee = audit.runnable.find((item) => item.id === 'coffee');
  if (!coffee) throw new Error('Demo requires the resolved coffee candidate');
  return immutable(
    demoProfiles.map((profile, index) => {
      const personSeed = deriveSeed(seed, profile.id),
        scheduleSeed = deriveSeed(personSeed, 'schedule');
      const schedule = createSchedule(startDate, scheduleSeed, false, demoScheduleConfig);
      const generated = generatePerson({
        seed: personSeed,
        personId: profile.id,
        from,
        to,
        effect: {
          metric: 'totalSleepMinutes',
          direction: 'higher',
          swingUnits: profile.effect,
          onDates: schedule.days
            .filter((day) => day.condition === 'on')
            .map((day) => day.sleepDate),
        },
      });
      const person = immutable({
        ...generated,
        history: generated.history.map((entry) => ({
          ...entry,
          night: {
            ...entry.night,
            rawPayloadId: fixtureUuid(`${profile.id}:sleep:${entry.night.sourceId}`),
          },
        })),
        workouts: generated.workouts.map((record) => ({
          ...record,
          rawPayloadId: fixtureUuid(`${profile.id}:workout:${record.sourceId}`),
        })),
        tags: generated.tags.map((record) => ({
          ...record,
          rawPayloadId: fixtureUuid(`${profile.id}:tag:${record.sourceId}`),
        })),
      });
      const baseline = planBaseline(
        person.history,
        'totalSleepMinutes',
        { source: 'synthetic', deviceModel: 'Distill synthetic v1' },
        startDate,
        startDate,
      );
      const registration = startExperiment({
        experimentId: `70000000-0000-4000-8000-00000000000${index + 1}`,
        cycleId: `80000000-0000-4000-8000-00000000000${index + 1}`,
        candidate: coffee,
        baseline,
        lockedAt: `${startDate}T12:00:00Z`,
        timeZone: 'UTC',
        direction: 'higher',
        onDefinition: 'Skip coffee after 2pm',
        offDefinition: 'Keep the usual afternoon coffee routine',
        seed: scheduleSeed,
        config: demoScheduleConfig,
        decisionPolicy: 'legacy',
      });
      const checkIns = registration.schedule.days.map((day) => {
        const generated = person.days.find((entry) => entry.sleepDate === day.sleepDate)!;
        return recordCheckIn(registration, {
          sleepDate: day.sleepDate,
          tap: generated.missedTap ? undefined : 'did',
          exclusions: generated.ill ? ['ill'] : [],
        });
      });
      const analysis = analyzeExperiment({
        registration,
        checkIns,
        nights: person.history,
        through: asOf,
      });
      return {
        version: 1 as const,
        synthetic: true as const,
        userId: profile.id,
        name: profile.name,
        asOf,
        from,
        to,
        seed,
        injectedEffect: profile.effect,
        person,
        inventory,
        answers,
        audit,
        registration,
        checkIns,
        analysis,
      };
    }),
  );
}
/** Safe demo screen payload: diagnostics, injected truth and seeds are not UI content. */
export function demoView(user: DemoUser) {
  const coffee = user.inventory.find((item) => item.id === user.registration.itemId)!;
  return {
    synthetic: true,
    userId: user.userId,
    name: user.name,
    asOf: user.asOf,
    from: user.from,
    to: user.to,
    inventory: user.inventory,
    answers: user.answers,
    audit: user.audit,
    auditText: user.audit.items.map((item) => ({
      itemId: item.id,
      verdict: renderAuditVerdict(item, user.answers[item.id] ?? {}),
    })),
    nights: user.person.history.map((entry) => entry.night),
    workouts: user.person.workouts,
    tags: user.person.tags,
    experiment: {
      status: 'completed',
      days: user.registration.schedule.days,
      checkIns: user.checkIns,
      result: experimentResultCard(user.analysis),
      verdict: renderExperimentVerdict(user.analysis, {
        itemName: coffee.name ?? user.audit.items.find((item) => item.id === coffee.id)!.name,
        monthlyCost: coffee.monthlyCost,
        source: user.answers[coffee.id]?.source,
        subject: 'on_condition',
      }),
    },
  };
}
