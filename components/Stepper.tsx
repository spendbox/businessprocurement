"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";

/**
 * One question per screen.
 *
 * Steps are declared as data rather than a switch on an index, because
 * several of them only exist depending on an earlier answer — asking for a
 * date only when someone said there is a deadline. Declaring a `when`
 * predicate keeps the list of live steps, the progress bar and the back
 * button all agreeing with each other without any bookkeeping at the call
 * site.
 */
export type Step<D> = {
  id: string;
  /** The question itself, used as the sheet heading. */
  title: string;
  subtitle?: string;
  /** Skip this step unless the answers so far call for it. */
  when?: (draft: D) => boolean;
  /** Which fields this step is responsible for validating. */
  fields: (keyof D)[];
  /** Answerable in one tap — move on by itself once answered. */
  autoAdvance?: boolean;
  /** Shows a "Skip" affordance rather than "Continue". */
  optional?: boolean;
  render: () => ReactNode;
};

export type Stepper<D> = {
  steps: Step<D>[];
  step: Step<D>;
  index: number;
  total: number;
  progress: number;
  isLast: boolean;
  direction: number;
  next: () => void;
  back: () => void;
  goToField: (field: keyof D) => void;
  /** Called by one-tap fields so answering also advances. */
  advanceAfterChoice: () => void;
};

export function useStepper<D>({
  steps,
  draft,
  validate,
  onFinish,
}: {
  steps: Step<D>[];
  draft: D;
  /** Returns true when the step's fields are acceptable. */
  validate: (fields: (keyof D)[]) => boolean;
  onFinish: () => void;
}): Stepper<D> {
  const [cursor, setCursor] = useState(0);
  const [direction, setDirection] = useState(1);

  const live = useMemo(
    () => steps.filter((s) => !s.when || s.when(draft)),
    [steps, draft],
  );

  // An answer can remove the step you are standing on; never point past the end.
  const index = Math.min(cursor, Math.max(0, live.length - 1));
  const step = live[index];
  const isLast = index === live.length - 1;

  const next = useCallback(() => {
    if (!step) return;
    if (!validate(step.fields)) return;
    if (isLast) {
      onFinish();
      return;
    }
    setDirection(1);
    setCursor(index + 1);
  }, [step, validate, isLast, onFinish, index]);

  const back = useCallback(() => {
    setDirection(-1);
    setCursor(Math.max(0, index - 1));
  }, [index]);

  /*
   * A tap that answers the question should carry you forward, but not so
   * fast that you cannot see what you picked.
   */
  const advanceAfterChoice = useCallback(() => {
    if (!step?.autoAdvance || isLast) return;
    window.setTimeout(() => {
      setDirection(1);
      setCursor((c) => c + 1);
    }, 280);
  }, [step, isLast]);

  /** Jump back to whichever step owns a field — used by the review screen. */
  const goToField = useCallback(
    (fieldName: keyof D) => {
      const target = live.findIndex((s) => s.fields.includes(fieldName));
      if (target < 0) return;
      setDirection(-1);
      setCursor(target);
    },
    [live],
  );

  return {
    steps: live,
    step,
    index,
    total: live.length,
    progress: live.length ? (index + 1) / live.length : 0,
    isLast,
    direction,
    next,
    back,
    goToField,
    advanceAfterChoice,
  };
}

/** The footer shared by both forms. */
export function StepFooter({
  stepper,
  submitting,
  submitLabel,
  tone = "forest",
  onSubmit,
}: {
  stepper: Stepper<never> | Stepper<any>;
  submitting: boolean;
  submitLabel: string;
  tone?: "forest" | "ink";
  onSubmit: () => void;
}) {
  const { index, isLast, next, back, step } = stepper;
  const primary =
    tone === "ink"
      ? "bg-ink-900 text-bone-50 hover:bg-ink-800"
      : "bg-forest-500 text-white hover:bg-forest-600";

  return (
    <div className="flex items-center gap-3">
      {index > 0 && (
        <button
          type="button"
          onClick={back}
          disabled={submitting}
          aria-label="Back"
          className="grid h-[56px] w-[56px] shrink-0 place-items-center rounded-full border-[1.5px] border-bone-300 text-ink-500 transition-colors hover:border-ink-800 hover:text-ink-900 disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
        </button>
      )}
      <button
        type="button"
        onClick={isLast ? onSubmit : next}
        disabled={submitting}
        className={`group flex min-h-[56px] flex-1 items-center justify-center gap-2.5 rounded-full text-[16px] font-bold transition-all duration-200 disabled:cursor-wait disabled:opacity-70 ${primary}`}
      >
        {submitting ? (
          <>
            <span
              aria-hidden
              className="h-4 w-4 animate-spin rounded-full border-2 border-current/35 border-t-current"
            />
            Sending…
          </>
        ) : (
          <>
            {isLast ? submitLabel : step?.optional ? "Skip for now" : "Continue"}
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </>
        )}
      </button>
    </div>
  );
}
