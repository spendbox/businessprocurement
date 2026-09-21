"use client";

import { useId, type ReactNode } from "react";
import { Check } from "./Icons";

/* ------------------------------------------------------------------ */
/* Shared shell                                                        */
/* ------------------------------------------------------------------ */

const inputBase =
  "w-full rounded-xl border-[1.5px] bg-bone-50 px-4 py-3 text-[15px] leading-normal text-ink-800 " +
  "placeholder:text-ink-300 transition-[border-color,box-shadow,background-color] duration-200 " +
  "hover:border-bone-300 focus:border-forest-500 focus:bg-white focus:outline-none " +
  "focus:ring-4 focus:ring-forest-500/14 min-h-[50px]";

function Shell({
  id,
  label,
  hint,
  error,
  children,
  optional,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  optional?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="flex items-baseline gap-2 text-[13px] font-bold text-ink-800">
        {label}
        {optional && (
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-300">
            optional
          </span>
        )}
      </label>
      {hint && <p className="-mt-1 text-[13px] leading-snug text-ink-400">{hint}</p>}
      {children}
      {error && (
        <p role="alert" className="text-[13px] font-semibold text-clay-400">
          {error}
        </p>
      )}
    </div>
  );
}

const borderFor = (error?: string) =>
  error ? "border-clay-400/70" : "border-bone-200";

/* ------------------------------------------------------------------ */
/* Text, textarea, select, date                                        */
/* ------------------------------------------------------------------ */

type TextProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  type?: "text" | "email" | "tel" | "url" | "date";
  autoComplete?: string;
  autoFocus?: boolean;
  min?: string;
};

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  error,
  optional,
  type = "text",
  autoComplete,
  autoFocus,
  min,
}: TextProps) {
  const id = useId();
  return (
    <Shell id={id} label={label} hint={hint} error={error} optional={optional}>
      <input
        id={id}
        type={type}
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        aria-invalid={error ? true : undefined}
        className={`${inputBase} ${borderFor(error)}`}
      />
    </Shell>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  hint,
  error,
  optional,
  rows = 4,
  autoFocus,
}: Omit<TextProps, "type" | "autoComplete" | "min"> & {
  rows?: number;
}) {
  const id = useId();
  return (
    <Shell id={id} label={label} hint={hint} error={error} optional={optional}>
      <textarea
        id={id}
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-invalid={error ? true : undefined}
        className={`${inputBase} resize-y leading-relaxed ${borderFor(error)}`}
      />
    </Shell>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = "Select one",
  hint,
  error,
  optional,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
}) {
  const id = useId();
  return (
    <Shell id={id} label={label} hint={hint} error={error} optional={optional}>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          className={`${inputBase} appearance-none pr-11 ${borderFor(error)} ${
            value ? "text-ink-800" : "text-ink-300"
          }`}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o} value={o} className="text-ink-800">
              {o}
            </option>
          ))}
        </select>
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        >
          <path d="M6 9.5 12 15l6-5.5" />
        </svg>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Chips (multi-select)                                                */
/* ------------------------------------------------------------------ */

export function ChipGroup({
  label,
  hint,
  options,
  selected,
  onToggle,
  error,
}: {
  label: string;
  hint?: string;
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
  error?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2 border-0 p-0">
      <legend className="text-[13px] font-bold text-ink-800">{label}</legend>
      {hint && <p className="text-[13px] leading-snug text-ink-400">{hint}</p>}
      <div className="mt-1 flex flex-wrap gap-2">
        {options.map((option) => {
          const on = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              aria-pressed={on}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border-[1.5px] px-4 text-[14px] font-semibold transition-all duration-200 ${
                on
                  ? "border-forest-500 bg-forest-500 text-white shadow-[0_8px_20px_-10px_rgba(15,122,82,0.7)]"
                  : "border-bone-200 bg-bone-50 text-ink-500 hover:border-forest-200 hover:bg-forest-50 hover:text-ink-800"
              }`}
            >
              {on && <Check className="h-3.5 w-3.5" />}
              {option}
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-[13px] font-semibold text-clay-400">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/* ------------------------------------------------------------------ */
/* Choice cards (single-select, used for urgency)                      */
/* ------------------------------------------------------------------ */

export function ChoiceCards<T extends string>({
  label,
  hint,
  options,
  value,
  onChange,
  error,
  columns = 2,
}: {
  label: string;
  hint?: string;
  options: { value: T; label: string; detail: string; heat?: number }[];
  value: T | "";
  onChange: (value: T) => void;
  error?: string;
  columns?: 2 | 3;
}) {
  return (
    <fieldset className="flex flex-col gap-2 border-0 p-0">
      <legend className="text-[13px] font-bold text-ink-800">{label}</legend>
      {hint && <p className="text-[13px] leading-snug text-ink-400">{hint}</p>}
      <div
        className={`mt-1 grid gap-2.5 ${
          columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"
        }`}
      >
        {options.map((o) => {
          const on = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              aria-pressed={on}
              className={`group relative overflow-hidden rounded-xl border-[1.5px] p-4 text-left transition-all duration-200 ${
                on
                  ? "border-forest-500 bg-forest-50 shadow-[0_10px_26px_-14px_rgba(15,122,82,0.55)]"
                  : "border-bone-200 bg-bone-50 hover:border-forest-200 hover:bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[15px] font-bold text-ink-800">{o.label}</span>
                <span
                  aria-hidden
                  className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-[1.5px] transition-colors ${
                    on ? "border-forest-500 bg-forest-500" : "border-bone-300 bg-white"
                  }`}
                >
                  {on && <Check className="h-3 w-3 text-white" />}
                </span>
              </div>
              <p className="mt-1 text-[13px] leading-snug text-ink-400">{o.detail}</p>
              {typeof o.heat === "number" && (
                <span aria-hidden className="mt-3 flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <i
                      key={n}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        n <= o.heat!
                          ? on
                            ? "bg-forest-500"
                            : "bg-amber-400"
                          : "bg-bone-300"
                      }`}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-[13px] font-semibold text-clay-400">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/* ------------------------------------------------------------------ */
/* Checkbox                                                            */
/* ------------------------------------------------------------------ */

export function CheckboxField({
  label,
  detail,
  checked,
  onChange,
}: {
  label: string;
  detail?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3 rounded-xl border-[1.5px] border-bone-200 bg-bone-50 p-4">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-forest-500"
      />
      <label htmlFor={id} className="cursor-pointer">
        <span className="block text-[14px] font-bold text-ink-800">{label}</span>
        {detail && (
          <span className="mt-0.5 block text-[13px] leading-snug text-ink-400">
            {detail}
          </span>
        )}
      </label>
    </div>
  );
}

/** Off-screen input that only bots fill in. */
export function Honeypot({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label htmlFor="company-url-hp">Leave this empty</label>
      <input
        id="company-url-hp"
        name="company-url"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
