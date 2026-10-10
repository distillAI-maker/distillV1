'use client';

import { useId, useState } from 'react';
import { Icon } from '../../../components/icon';
import { Button, Chip, Field } from '../../../components/ui';
import { displayName } from '../../../lib/catalog/short-names';
import { copy } from '../../../lib/copy';
import type { AskableField } from '../../../lib/followups/fields';
import { engineGoalLabels, goalOptionsFor } from '../../../lib/followups/goals';
import { unitLabels } from '../../../lib/followups/items';
import type { Asked } from '../../../lib/followups/resolve';
import type { StackItem } from '../../../lib/progress/types';

/** What one answer changes on the stack item. */
export interface AnswerPatch {
  answers?: Record<string, unknown>;
  chips?: Record<string, string>;
  unknown?: string[];
  /** Fields the person answered after all, to drop from the unknown list. */
  known?: string[];
  confirmedRead?: boolean;
  clearAnswers?: boolean;
}

export function applyPatch(item: StackItem, patch: AnswerPatch): StackItem {
  const answers = patch.clearAnswers ? {} : { ...item.answers, ...(patch.answers ?? {}) };
  const chips = patch.clearAnswers ? {} : { ...item.chips, ...(patch.chips ?? {}) };
  let unknown = patch.clearAnswers ? [] : [...item.unknown];
  for (const f of patch.known ?? []) unknown = unknown.filter((u) => u !== f);
  for (const f of patch.unknown ?? []) {
    if (!unknown.includes(f)) unknown.push(f);
    delete answers[f];
  }
  return {
    ...item,
    answers,
    chips,
    unknown,
    confirmedRead: patch.confirmedRead ?? item.confirmedRead,
  };
}

const fieldCopy = copy.questions.fields as Record<
  string,
  { q: string; line?: string; exact?: string }
>;

/** The question with its item in front: "Magnesium: which form is it?". */
export function withItem(name: string, question: string): string {
  const keepCase = /^(I\b|[A-Z]{2})/.test(question);
  const q = keepCase ? question : question.charAt(0).toLowerCase() + question.slice(1);
  return `${name}: ${q}`;
}

/** One answer as a ruled row with a square check, as in the Figma build. */
function Answer({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button type="button" role="radio" aria-checked={selected} className="chip" onClick={onClick}>
      <span>{children}</span>
      <b aria-hidden="true">{selected ? '✓' : ''}</b>
    </button>
  );
}

function numberOrNull(s: string): number | null {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function QuestionView({
  asked,
  count,
  goals,
  onSubmit,
}: {
  asked: Asked;
  count: { k: number; n: number };
  goals: string[];
  onSubmit: (patch: AnswerPatch) => void;
}) {
  const q = asked.question;
  const name = displayName({ itemKey: asked.item.key, label: asked.stored.label }, asked.item.name);
  const pre = asked.prefilled;
  const id = useId();
  const [choice, setChoice] = useState<string | null | undefined>(
    q.kind === 'form' ||
      q.kind === 'range' ||
      q.kind === 'time' ||
      q.kind === 'goal' ||
      q.kind === 'bool'
      ? pre === undefined
        ? undefined
        : pre === null
          ? null
          : String(pre)
      : undefined,
  );
  const [text, setText] = useState<string>(() => (typeof pre === 'number' ? String(pre) : ''));
  const stored = asked.stored.answers;
  const [serving, setServing] = useState<string>(() =>
    typeof stored.servingAmount === 'number' ? String(stored.servingAmount) : '',
  );
  const [servings, setServings] = useState<string>(() =>
    typeof stored.servingsPerDay === 'number' ? String(stored.servingsPerDay) : '',
  );
  const [problem, setProblem] = useState<string | null>(null);

  const head = (
    <div className="q-progress" aria-hidden="true">
      {Array.from({ length: count.n }, (_, i) => (
        <span key={i} className={i < count.k ? 'on' : ''} />
      ))}
    </div>
  );

  function need(msg: string) {
    setProblem(msg);
  }

  // Confirmation of something read from the wearable or the demo fixture.
  if (q.kind === 'confirm') {
    return (
      <section className="stack screen-q">
        {head}
        <h1>{copy.questions.readFrom(q.source)}</h1>
        <div className="glass read-card">
          <span className="label">{name}</span>
          <p className="line">{q.summary}</p>
        </div>
        <div className="actions-row">
          <Button onClick={() => onSubmit({ confirmedRead: true })} autoFocus>
            {copy.questions.thatsRight}
          </Button>
          <Button
            variant="ghost"
            onClick={() => onSubmit({ confirmedRead: true, clearAnswers: true })}
          >
            {copy.questions.changeIt}
          </Button>
        </div>
      </section>
    );
  }

  const fc = fieldCopy[q.field] ?? { q: q.field };
  // The item is written into the question, as the Figma does, instead of a label above it.
  const title = withItem(name, q.kind === 'exact' ? (fc.exact ?? fc.q) : fc.q);

  function submitChips() {
    if (choice === undefined) return need(copy.common.pickOne);
    if (q.kind === 'form') {
      const chip = q.chips.find((c) => c.label === choice);
      if (!chip) return need(copy.common.pickOne);
      if (chip.value === null) return onSubmit({ unknown: ['form'], chips: { form: chip.label } });
      return onSubmit({
        answers: { form: chip.value },
        chips: { form: chip.label },
        known: ['form'],
      });
    }
    if (q.kind === 'time') {
      const chip = q.chips.find((c) => c.label === choice);
      if (!chip) return need(copy.common.pickOne);
      return onSubmit({
        answers: { time: chip.value },
        chips: { time: chip.label },
        known: ['time'],
      });
    }
    if (q.kind === 'goal') {
      const value = choice as string;
      return onSubmit({
        answers: { goal: value },
        chips: { goal: engineGoalLabels[value as keyof typeof engineGoalLabels] ?? value },
        known: ['goal'],
      });
    }
    if (q.kind === 'range') {
      return onSubmit({ chips: { [q.field]: choice as string } });
    }
    if (q.kind === 'bool') {
      if (choice === null) return onSubmit({ unknown: [q.field] });
      return onSubmit({ answers: { [q.field]: choice === 'true' }, known: [q.field] });
    }
  }
  function submitNumber() {
    const n = numberOrNull(text);
    if (n === null) return need(copy.common.enterNumber);
    const field = q.field as AskableField;
    onSubmit({ answers: { [field]: n }, known: [field] });
  }
  function submitDose() {
    if (q.kind !== 'dose') return;
    if (q.perServing) {
      const a = numberOrNull(serving);
      const c = numberOrNull(servings);
      if (a === null || c === null) return need(copy.common.enterNumber);
      return onSubmit({
        answers: { dose: a * c, servingAmount: a, servingsPerDay: c },
        known: ['dose', 'doseUnit'],
      });
    }
    const n = numberOrNull(text);
    if (n === null) return need(copy.common.enterNumber);
    onSubmit({ answers: { dose: n }, known: ['dose', 'doseUnit'] });
  }

  let body = null;
  if (q.kind === 'form' || q.kind === 'time' || q.kind === 'range') {
    const chips = q.chips.map((c) => c.label);
    body = (
      <div className="answers" role="radiogroup" aria-label={title}>
        {chips.map((label) => (
          <Answer key={label} selected={choice === label} onClick={() => setChoice(label)}>
            {label}
          </Answer>
        ))}
      </div>
    );
  } else if (q.kind === 'goal') {
    body = (
      <div className="answers" role="radiogroup" aria-label={title}>
        {goalOptionsFor(goals).map((g) => (
          <Answer key={g} selected={choice === g} onClick={() => setChoice(g)}>
            {engineGoalLabels[g]}
          </Answer>
        ))}
      </div>
    );
  } else if (q.kind === 'bool') {
    body = (
      <div className="answers" role="radiogroup" aria-label={title}>
        <Answer selected={choice === 'true'} onClick={() => setChoice('true')}>
          {copy.common.yes}
        </Answer>
        <Answer selected={choice === 'false'} onClick={() => setChoice('false')}>
          {copy.common.no}
        </Answer>
        {q.notSure ? (
          <Answer selected={choice === null} onClick={() => setChoice(null)}>
            {copy.common.notSure}
          </Answer>
        ) : null}
      </div>
    );
  } else if (q.kind === 'number' || q.kind === 'exact') {
    body = (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitNumber();
        }}
      >
        {q.kind === 'exact' ? <p className="muted">{copy.questions.pickedChip(q.chip)}</p> : null}
        <Field
          id={`${id}-n`}
          label={title}
          type="number"
          inputMode="decimal"
          unit={q.unit}
          min={q.min}
          max={q.max}
          step={'step' in q && q.step ? q.step : 'any'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
      </form>
    );
  } else if (q.kind === 'dose') {
    const unit = unitLabels[q.unit];
    body = q.perServing ? (
      <form
        className="two-boxes"
        onSubmit={(e) => {
          e.preventDefault();
          submitDose();
        }}
      >
        <Field
          id={`${id}-s`}
          label={q.perServing.serving}
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={serving}
          onChange={(e) => setServing(e.target.value)}
          autoFocus
        />
        <Field
          id={`${id}-c`}
          label={q.perServing.count}
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={servings}
          onChange={(e) => setServings(e.target.value)}
        />
        {numberOrNull(serving) !== null && numberOrNull(servings) !== null ? (
          <p className="sum">
            <b>
              {copy.questions.dailyTotal(
                String((numberOrNull(serving) ?? 0) * (numberOrNull(servings) ?? 0)),
                unit,
              )}
            </b>
          </p>
        ) : null}
      </form>
    ) : (
      <form
        className="stack-tight"
        onSubmit={(e) => {
          e.preventDefault();
          submitDose();
        }}
      >
        <Field
          id={`${id}-d`}
          label={title}
          type="number"
          inputMode="decimal"
          unit={unit}
          min={0}
          step="any"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        {q.presets?.length ? (
          <div className="presets" aria-label={unit}>
            {q.presets.map((p) => (
              <Chip key={p} selected={text === String(p)} onClick={() => setText(String(p))}>
                {p}
              </Chip>
            ))}
          </div>
        ) : null}
      </form>
    );
  }

  const isNumberLike = q.kind === 'number' || q.kind === 'exact' || q.kind === 'dose';
  return (
    <section className="stack screen-q">
      {head}
      <h1>{title}</h1>
      <div className={isNumberLike ? 'q-number' : undefined}>{body}</div>
      {problem ? (
        <p className="notice" role="alert">
          {problem}
        </p>
      ) : null}
      <div className="actions">
        <Button
          onClick={() => {
            setProblem(null);
            if (q.kind === 'dose') submitDose();
            else if (isNumberLike) submitNumber();
            else submitChips();
          }}
        >
          {copy.common.continue}
          <Icon name="arrow" size={18} />
        </Button>
      </div>
    </section>
  );
}
