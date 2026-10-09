import catalog from '../../../../data/catalog.json' with { type: 'json' };
import type { Catalog } from '@distill/catalog';
import type { AnalysisResult } from '../stats/types.js';
import { experimentResultCard } from '../stats/presentation.js';
import type { RoutedItem, StackAnswers } from '../route/types.js';
import { immutable } from '../experiment/utils.js';
import { formatChange, formatCount, formatDose, formatMeasurement, formatMoney } from './format.js';
import {
  checkedText,
  renderTemplate,
  sourceClause,
  templateNames,
  VerdictTextError,
} from './templates.js';
import type { RenderedTemplate, SourceOrigin, TemplateId } from './templates.js';

export type CopyPolicy = 'exact' | 'contextual';
export type VerdictText =
  | {
      readonly status: 'ready';
      readonly text: string;
      readonly templateId: TemplateId | null;
      readonly variant: 'source' | 'contextual';
      readonly source: { readonly sheet: string; readonly row: number } | null;
      readonly unverified: boolean;
      readonly wordCount: number;
    }
  | {
      readonly status: 'needs_context' | 'needs_review';
      readonly text: null;
      readonly issues: readonly string[];
      readonly unverified: boolean;
    };
export interface VerdictContext {
  readonly itemName: string;
  readonly monthlyCost?: number;
  /** Actual recorded use duration; never inferred from the number of wearable nights. */
  readonly monthsUsed?: number;
  readonly source?: SourceOrigin;
  /** Restriction experiments use their saved on-condition as the subject. */
  readonly subject?: 'item' | 'on_condition';
  readonly doseExperiment?: boolean;
  /** True only when dropping the tested on-condition actually removes this monthly charge. */
  readonly dropsCharge?: boolean;
  readonly copyPolicy?: CopyPolicy;
}
const blocked = (
  status: 'needs_context' | 'needs_review',
  issue: string,
  unverified: boolean,
): VerdictText => immutable({ status, text: null, issues: [issue], unverified });
const ready = (rendered: RenderedTemplate): VerdictText =>
  immutable({ status: 'ready', ...rendered, variant: 'source' });
function contextual(text: string, id: TemplateId | null, unverified: boolean): VerdictText {
  const source = id
    ? catalog.verdictTemplates.find((template) => template.name === templateNames[id])!.source
    : null;
  const checked = checkedText(text, (catalog as unknown as Catalog).toneRules, id === 'gated');
  return immutable({
    status: 'ready',
    text: checked,
    templateId: id,
    variant: 'contextual',
    source,
    unverified,
    wordCount: checked.trim().split(/\s+/u).length,
  });
}
function attempt(unverified: boolean, work: () => VerdictText): VerdictText {
  try {
    return work();
  } catch (error) {
    if (error instanceof VerdictTextError)
      return blocked(
        error.code === 'MISSING_VALUE' ? 'needs_context' : 'needs_review',
        error.code,
        unverified,
      );
    throw error;
  }
}
function label(name: string) {
  if (typeof name !== 'string' || !name.trim() || /[{}\p{Cc}]/u.test(name))
    throw new VerdictTextError('INVALID_VALUE', 'A plain item name is required');
  return name.trim();
}
function cost(value: number | undefined): string | undefined {
  return value === undefined ? undefined : formatMoney(value);
}
function months(value: number | undefined): string | undefined {
  return value === undefined ? undefined : formatCount(value);
}
function metricLabel(name: string) {
  return `your ${name === 'Overnight HRV' ? 'overnight HRV' : name.toLowerCase()}`;
}
function directionalChange(result: AnalysisResult) {
  const value = result.effect!.difference;
  return value === 0
    ? 'no measured change'
    : `${formatChange(value, experimentResultCard(result).unit)} ${value > 0 ? 'higher' : 'lower'}`;
}
/** "about 9 in 10", from a probability; never more precise than tenths. */
function chanceText(probability: number): string {
  const tenths = Math.max(1, Math.min(10, Math.round(probability * 10)));
  return tenths >= 10 ? 'Better than 19 in 20' : `About ${tenths} in 10`;
}
/** Sentences for the estimate-based policy (docs/ALGORITHM-IDENTITY.md). Every line is tone-checked. */
function renderEstimateVerdict(result: AnalysisResult, context: VerdictContext): VerdictText {
  const outcome = result.outcome!;
  const card = experimentResultCard(result);
  const subject = label(context.subject === 'item' ? context.itemName : result.onDefinition);
  const number = metricLabel(result.metricName);
  const swing = card.swing ? formatMeasurement(card.swing.value, card.swing.unit) : null;
  // The change is read in the swing's own unit: percent for HRV, the metric's unit otherwise.
  const change = result.effect
    ? card.percentChange !== null
      ? formatChange(card.percentChange, 'percent')
      : formatChange(result.effect.difference, card.unit)
    : null;
  const beneficial =
    result.effect &&
    (result.direction === 'higher'
      ? result.effect.transformedDifference > 0
      : result.effect.transformedDifference < 0);
  const nights = result.validNights.on + result.validNights.off;
  const monthly = cost(context.monthlyCost);
  const paid = context.dropsCharge === true && context.subject === 'item' && (context.monthlyCost ?? 0) > 0;
  const observed = result.design === 'observational';
  const onNights = observed ? 'on the nights it happened' : 'on the nights you did it';
  const compared = observed ? ' than on the other nights' : '';
  const caveat = observed ? ' Those nights were not assigned, so other things may differ too.' : '';
  const use =
    context.monthsUsed === undefined
      ? ''
      : ` ${formatCount(context.monthsUsed)} months in${sourceClause(context.source)}.`;
  const bill = monthly === undefined || context.monthlyCost === 0 ? '' : ` It costs ${monthly} a month.`;
  const text = (line: string, id: TemplateId | null) => contextual(line, id, result.unverified);
  if (outcome === 'in_progress')
    return text(
      `${subject}: this test is still in progress. The first read comes on ${result.look?.next ?? 'the next look'}.`,
      'inconclusive',
    );
  if (outcome === 'not_enough_nights')
    return text(
      `${subject}: too few usable nights on one side to compare fairly (${result.validNights.on} on, ${result.validNights.off} off). ${result.look?.complete ? 'No verdict. Your call whether it stays.' : 'No verdict yet. Keep tapping and the comparison fills in.'}`,
      'inconclusive',
    );
  if (!change || !swing || !result.estimate)
    return blocked('needs_review', 'ESTIMATE_RESULT_MISSING_EVIDENCE', result.unverified);
  const chance = result.estimate.probabilities;
  if (outcome === 'helps') {
    if (!beneficial) return blocked('needs_review', 'VERDICT_DIRECTION_MISMATCH', result.unverified);
    return text(
      `${subject}: ${number} was ${change} better ${onNights}${compared}, against your normal swing of ${swing}.${caveat} ${chanceText(chance.helps)} that it helps. That's real, and it's yours. Kept.`,
      'kept',
    );
  }
  if (outcome === 'costs_you') {
    if (beneficial) return blocked('needs_review', 'VERDICT_DIRECTION_MISMATCH', result.unverified);
    const close = paid
      ? ` Dropped, and ${monthly} a month back.`
      : ' Dropped. Your call whether the usual routine stays.';
    return text(
      `${subject}: ${number} was ${change} worse ${onNights}${compared}, against your normal swing of ${swing}.${caveat}${use} ${chanceText(chance.hurts)} that it costs you.${close}`,
      'dropped',
    );
  }
  const direction = result.effect!.difference === 0 ? 'no change' : `${change} ${result.effect!.difference > 0 ? 'higher' : 'lower'}`;
  if (outcome === 'no_detectable_benefit') {
    const lean = result.leans === 'harm' ? ' If anything, the nights leaned the other way.' : '';
    const close = paid
      ? ` It does nothing we can see, and it costs ${monthly} a month. Dropped.`
      : ' It does nothing we can see. It costs nothing, so keep it if you like it; it just comes off the list of things that work.';
    return text(
      `${subject}: ${direction} on ${number} across ${nights} nights, against your normal swing of ${swing}. We looked for a benefit and could not find one.${lean}${close}`,
      'dropped',
    );
  }
  if (outcome === 'too_close_extend')
    return text(
      `${subject}: ${direction} on ${number} so far, close to your normal swing of ${swing}. Too close to call yet. One more week settles it, and the daily line carries on.`,
      'inconclusive',
    );
  return text(
    `${subject}: ${direction} on ${number} after ${nights} nights, against your normal swing of ${swing}. Too close to call, and we won't pretend otherwise. Your call whether it stays.${bill}`,
    'inconclusive',
  );
}
export function renderExperimentVerdict(
  result: AnalysisResult,
  context: VerdictContext,
): VerdictText {
  return attempt(result.unverified, () => {
    if (context.source === 'doctor' || context.source === 'blood test')
      return blocked('needs_review', 'PROTECTED_SOURCE', result.unverified);
    if (result.outcome) return renderEstimateVerdict(result, context);
    const card = experimentResultCard(result),
      policy = context.copyPolicy ?? 'contextual';
    const subject = label(context.subject === 'item' ? context.itemName : result.onDefinition);
    const number = metricLabel(result.metricName),
      change = result.effect ? formatChange(result.effect.difference, card.unit) : null;
    const swing = card.swing ? formatMeasurement(card.swing.value, card.swing.unit) : null;
    const monthly = cost(context.monthlyCost),
      duration = months(context.monthsUsed);
    const verdict = result.verdict;
    if (verdict === 'Kept' || verdict === 'Dropped') {
      if (
        result.design !== 'randomized' ||
        result.reasons.length ||
        !result.effect ||
        !swing ||
        !result.randomization
      )
        return blocked('needs_review', 'DECISIVE_RESULT_MISSING_EVIDENCE', result.unverified);
      const beneficial =
        result.direction === 'higher'
          ? result.effect.transformedDifference > 0
          : result.effect.transformedDifference < 0;
      if ((verdict === 'Kept') !== beneficial)
        return blocked('needs_review', 'VERDICT_DIRECTION_MISMATCH', result.unverified);
      if (verdict === 'Kept')
        return ready(
          renderTemplate(
            'kept',
            { item: subject, number, change: change!, swing },
            { unverified: result.unverified },
          ),
        );
      const outside = Math.abs(result.effect.swingUnits ?? 0) > 1;
      if (
        outside &&
        context.dropsCharge === true &&
        context.subject === 'item' &&
        duration !== undefined &&
        monthly !== undefined &&
        context.monthlyCost! > 0
      )
        return ready(
          renderTemplate(
            'dropped',
            {
              item: subject,
              number,
              change: change!,
              swing,
              months: duration,
              source_clause: context.source,
              cost: monthly,
            },
            { unverified: result.unverified },
          ),
        );
      if (policy === 'exact')
        return blocked(
          'needs_review',
          'DROPPED_COPY_REQUIRES_OUTSIDE_SWING_AND_ACTUAL_SAVINGS',
          result.unverified,
        );
      const use =
        duration === undefined ? '' : ` ${duration} months in${sourceClause(context.source)}.`;
      const savings =
        context.dropsCharge === true && context.subject === 'item' && (context.monthlyCost ?? 0) > 0
          ? ` Dropped, and ${monthly} a month back.`
          : ' Dropped. Your call whether the usual routine stays.';
      return contextual(
        `${subject}: ${number} was ${change} worse on the days you did it, against your normal swing of ${swing}.${use}${savings}`,
        'dropped',
        result.unverified,
      );
    }
    const inferenceEligible =
      result.design === 'randomized' &&
      result.reasons.every(
        (reason) => reason === 'not_significant' || reason === 'no_difference',
      ) &&
      result.effect &&
      swing;
    if (
      inferenceEligible &&
      context.doseExperiment &&
      context.subject === 'item' &&
      Math.abs(result.effect!.swingUnits ?? Infinity) < 1 &&
      monthly !== undefined
    )
      return ready(
        renderTemplate(
          'inconclusive',
          {
            item: subject,
            number,
            change: directionalChange(result),
            swing: swing!,
            cost: monthly,
          },
          { unverified: result.unverified },
        ),
      );
    if (policy === 'exact')
      return blocked(
        'needs_review',
        'INCONCLUSIVE_COPY_DOES_NOT_MATCH_THIS_RESULT',
        result.unverified,
      );
    if (result.reasons.includes('experiment_not_finished'))
      return contextual(
        `${subject}: this test is still in progress. There isn't a finished result yet.`,
        'inconclusive',
        result.unverified,
      );
    if (result.design === 'observational') {
      const comparison = result.effect ? ` ${directionalChange(result)} on ${number}.` : '';
      return contextual(
        `${subject}:${comparison} This is an observational comparison, so other things can explain the difference. Inconclusive. Your call whether it stays.`,
        'inconclusive',
        result.unverified,
      );
    }
    const detail = result.reasons.includes('assignment_resolution')
      ? 'This schedule cannot give a clear answer under its saved rules.'
      : result.reasons.includes('noncompliance')
        ? 'The recorded on and off days did not match the assigned days.'
        : result.reasons.includes('insufficient_nights')
          ? 'There were not enough usable nights on both sides.'
          : result.reasons.includes('baseline_unavailable') ||
              result.reasons.includes('zero_personal_swing')
            ? 'Your usual swing was not available for a reliable comparison.'
            : result.reasons.includes('effect_direction_disagreement')
              ? 'The two ways of comparing this number pointed in different directions.'
              : result.reasons.includes('opposite_direction_not_tested')
                ? 'The change went in a direction this saved test did not ask about.'
                : !result.effect || !swing || !result.randomization
                  ? 'There was not enough information for a reliable comparison.'
                  : 'This test did not give a clear answer.';
    const comparison =
      result.effect && swing
        ? `${directionalChange(result)} on ${number}, against your normal swing of ${swing}. `
        : '';
    const bill =
      monthly === undefined || context.monthlyCost === 0 ? '' : ` It costs ${monthly} a month.`;
    return contextual(
      `${subject}: ${comparison}${detail} Inconclusive. Your call whether it stays.${bill}`,
      'inconclusive',
      result.unverified,
    );
  });
}
export interface AuditTextContext {
  readonly copyPolicy?: CopyPolicy;
  readonly source?: SourceOrigin;
  readonly monthsUsed?: number;
  /** Reviewed study summary, exact compatible dose threshold and names; no prose parsing. */
  readonly evidence?: string;
  readonly threshold?: { readonly value: number; readonly unit: string };
  readonly otherItem?: string;
  readonly otherMonthlyCost?: number;
  readonly gateHook?: string;
  readonly gateFraction?: string;
  readonly protocolDays?: number;
  readonly freeAndHarmlessConfirmed?: boolean;
}
export function renderAuditVerdict(
  item: RoutedItem,
  answers: StackAnswers,
  context: AuditTextContext = {},
): VerdictText {
  return attempt(item.unverified, () => {
    const name = label(item.name),
      policy = context.copyPolicy ?? 'contextual';
    const render = <K extends TemplateId>(id: K, values: Parameters<typeof renderTemplate<K>>[1]) =>
      ready(renderTemplate(id, values, { unverified: item.unverified }));
    const needs = (field: string) => blocked('needs_context', field, item.unverified);
    const source = context.source ?? answers.source;
    if (item.tier === 'PROTECTED') {
      if (policy === 'exact')
        return blocked(
          'needs_review',
          'PROTECTED_SOURCE_HAS_TWO_SENTENCES_AND_ASSUMES_CLINICIAN',
          item.unverified,
        );
      const origin =
        source === 'blood test'
          ? 'came from your blood test'
          : source === 'doctor'
            ? 'came from your clinician'
            : answers.dataSource
              ? 'is a data source'
              : 'is Protected';
      return contextual(
        `${name}: this ${origin}, so we don't rate it, test it, or suggest stopping it.`,
        'protected',
        item.unverified,
      );
    }
    if (source === 'doctor' || source === 'blood test')
      return blocked('needs_review', 'PROTECTED_SOURCE', item.unverified);
    const monthly = cost(item.monthlyCost),
      annual = cost(item.annualCost);
    if (item.excluded || item.teamQuestions?.length)
      return blocked(
        'needs_review',
        item.excluded ? 'EXCLUDED_ITEM' : 'SOURCE_CONFLICT',
        item.unverified,
      );
    if (item.needsAnswers?.length) return needs('UNANSWERED_FOLLOW_UPS');
    if (item.tier === 'T2') {
      if (monthly === undefined) return needs('MONTHLY_COST');
      switch (item.reason) {
        case 'dose too low':
          if (answers.dose === undefined || !answers.doseUnit || !context.threshold)
            return needs('DOSE_AND_REVIEWED_THRESHOLD');
          if (answers.doseUnit !== context.threshold.unit)
            return blocked('needs_review', 'DOSE_UNIT_MISMATCH', item.unverified);
          return render('dose', {
            item: name,
            dose: formatDose(answers.dose, answers.doseUnit),
            threshold: formatDose(context.threshold.value, context.threshold.unit),
            cost: monthly,
          });
        case 'form not absorbed':
          if (!answers.form) return needs('FORM');
          return render('form', { item: name, form: answers.form, cost: monthly });
        case 'tested, found nothing':
          if (context.monthsUsed === undefined) return needs('MONTHS_USED');
          return render('noEvidence', {
            item: name,
            months: formatCount(context.monthsUsed),
            source_clause: source,
            cost: monthly,
          });
        case 'no way it could work':
          return render('noMechanism', { item: name, cost: monthly });
        case 'overlaps with something else':
          if (!context.otherItem || context.otherMonthlyCost === undefined)
            return needs('OTHER_ITEM_AND_COST');
          return render('duplicate', {
            item: name,
            other: context.otherItem,
            cost: formatMoney(context.otherMonthlyCost),
          });
        case 'not being used':
          if (policy === 'exact')
            return blocked('needs_review', 'NO_SOURCE_TEMPLATE_FOR_UNUSED_ITEM', item.unverified);
          return contextual(
            `${name}: you're not using this right now. It costs ${monthly} a month. Your call whether it stays.`,
            null,
            item.unverified,
          );
        default:
          return blocked('needs_review', 'NO_DROP_REASON', item.unverified);
      }
    }
    if (item.tier === 'T1_QUEUED_SLOW') {
      if (!context.evidence) return needs('REVIEWED_EVIDENCE');
      return render('slow', { item: name, evidence: context.evidence });
    }
    if (item.tier === 'T1_QUEUED_SPECIAL')
      return blocked('needs_review', 'NO_SOURCE_TEMPLATE_FOR_SPECIAL_DESIGN', item.unverified);
    if (item.tier === 'T1') return needs('EXPERIMENT_RESULT');
    if (item.tier === 'T3_TOO_SMALL') {
      if (!context.gateHook || !context.gateFraction)
        return needs('REVIEWED_GATE_HOOK_AND_FRACTION');
      if (context.protocolDays !== undefined && context.protocolDays !== 14) {
        formatCount(context.protocolDays);
        if (policy === 'exact')
          return blocked('needs_review', 'GATED_SOURCE_COPY_ASSUMES_TWO_WEEKS', item.unverified);
        return contextual(
          `${label(context.gateHook)} The studies estimated a change of about ${label(context.gateFraction)} of one night's normal swing. That can be hard to see in your data. We'll show you what the trials found and what it costs. Your call whether to test it.`,
          'gated',
          item.unverified,
        );
      }
      return render('gated', { hook: context.gateHook, fraction: context.gateFraction });
    }
    if (item.detail === 'untestable_goal') {
      if (annual === undefined) return needs('ANNUAL_COST');
      return render('noGoal', { item: name, annual });
    }
    if (item.monthlyCost === 0 && context.freeAndHarmlessConfirmed)
      return render('free', { item: name });
    if (item.keep) return render('keep', { item: name });
    if (item.dailyRating) {
      if (!context.evidence || annual === undefined || !item.suggestedWeeks)
        return needs('REVIEWED_EVIDENCE_COST_AND_WEEKS');
      const [from, to] = item.suggestedWeeks;
      return render('rating', {
        item: name,
        annual,
        evidence: context.evidence,
        goal: item.dailyRating,
        weeks: from === to ? formatCount(from) : `${formatCount(from)} to ${formatCount(to)}`,
      });
    }
    return blocked('needs_review', 'NO_SOURCE_TEMPLATE_FOR_THIS_ROUTING', item.unverified);
  });
}
