"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Close, Search } from "./Icons";

const inputBase =
  "w-full rounded-xl border-[1.5px] bg-bone-50 px-4 py-3 text-[15px] leading-normal text-ink-800 " +
  "placeholder:text-ink-300 transition-[border-color,box-shadow,background-color] duration-200 " +
  "hover:border-bone-300 focus:border-forest-500 focus:bg-white focus:outline-none " +
  "focus:ring-4 focus:ring-forest-500/14 min-h-[50px]";

function score(option: string, query: string): number {
  const o = option.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return 1;
  if (o === q) return 1000;
  if (o.startsWith(q)) return 500 - o.length;
  // match the start of any word, so "port" finds "Port Harcourt"
  if (o.split(/[\s-/(]+/).some((w) => w.startsWith(q))) return 300 - o.length;
  if (o.includes(q)) return 100 - o.length;
  return 0;
}

/**
 * A single-select dropdown you can type into.
 *
 * Built on a plain text input plus a listbox rather than a native <select>,
 * because a 37-item state list needs searching. Keyboard and screen-reader
 * behaviour follows the combobox pattern: arrows move, Enter picks, Escape
 * closes, and the active option is announced.
 */
export function Combobox({
  label,
  value,
  onChange,
  options,
  placeholder = "Start typing…",
  hint,
  error,
  optional,
  disabled,
  disabledHint,
  /** Let people submit something that is not in the list. */
  allowCustom = false,
  emptyMessage = "No match. Type it in full and we will use that.",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  disabled?: boolean;
  disabledHint?: string;
  allowCustom?: boolean;
  emptyMessage?: string;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const matches = useMemo(() => {
    if (options.length === 0) return [];
    return options
      .map((o) => ({ o, s: score(o, query) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 80)
      .map((x) => x.o);
  }, [options, query]);

  /* Close when focus or a click leaves the component. */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  /* Keep the highlighted option in view. */
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const commit = (next: string) => {
    onChange(next);
    setQuery("");
    setOpen(false);
    input.current?.blur();
  };

  const freeTextOnly = options.length === 0;

  if (freeTextOnly || disabled) {
    // No list to search (or nothing chosen upstream yet) — a plain field is
    // more honest than a dropdown with nothing in it.
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
        {(hint || (disabled && disabledHint)) && (
          <p className="-mt-1 text-[13px] leading-snug text-ink-400">
            {disabled && disabledHint ? disabledHint : hint}
          </p>
        )}
        <input
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder={disabled ? "" : placeholder}
          aria-invalid={error ? true : undefined}
          className={`${inputBase} ${
            error ? "border-clay-400/70" : "border-bone-200"
          } disabled:cursor-not-allowed disabled:bg-bone-200/50 disabled:text-ink-300`}
        />
        {error && (
          <p role="alert" className="text-[13px] font-semibold text-clay-400">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" ref={wrap}>
      <label htmlFor={id} className="flex items-baseline gap-2 text-[13px] font-bold text-ink-800">
        {label}
        {optional && (
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-300">
            optional
          </span>
        )}
      </label>
      {hint && <p className="-mt-1 text-[13px] leading-snug text-ink-400">{hint}</p>}

      <div className="relative">
        <input
          id={id}
          ref={input}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && matches[active] ? `${id}-opt-${active}` : undefined}
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          value={open ? query : value}
          placeholder={value || placeholder}
          onFocus={() => {
            setOpen(true);
            setQuery("");
            setActive(0);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            if (!open) setOpen(true);
            if (allowCustom) onChange(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(matches.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter") {
              if (open && matches[active]) {
                e.preventDefault();
                commit(matches[active]);
              }
            } else if (e.key === "Escape") {
              if (open) {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                setQuery("");
              }
            }
          }}
          className={`${inputBase} pr-11 ${
            error ? "border-clay-400/70" : "border-bone-200"
          } ${!value && !open ? "placeholder:text-ink-300" : ""}`}
        />

        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400">
          {open ? (
            <Search className="h-4 w-4" />
          ) : value ? (
            <span className="pointer-events-auto block">
              <button
                type="button"
                aria-label={`Clear ${label}`}
                onClick={() => {
                  onChange("");
                  input.current?.focus();
                }}
                className="grid h-6 w-6 place-items-center rounded-full text-ink-300 transition-colors hover:bg-bone-200 hover:text-ink-700"
              >
                <Close className="h-3.5 w-3.5" />
              </button>
            </span>
          ) : (
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            >
              <path d="M6 9.5 12 15l6-5.5" />
            </svg>
          )}
        </span>

        <AnimatePresence>
          {open && (
            <motion.ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={label}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: [0.22, 0.72, 0.18, 1] }}
              className="absolute z-30 mt-1.5 max-h-[min(280px,40svh)] w-full overflow-y-auto overscroll-contain rounded-xl border-[1.5px] border-bone-200 bg-white p-1 shadow-lift"
            >
              {matches.length === 0 ? (
                <li className="px-3 py-3 text-[13.5px] leading-snug text-ink-400">
                  {allowCustom ? emptyMessage : "No match."}
                </li>
              ) : (
                matches.map((o, i) => {
                  const selected = o === value;
                  return (
                    <li key={o} data-index={i}>
                      <button
                        type="button"
                        id={`${id}-opt-${i}`}
                        role="option"
                        aria-selected={selected}
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={() => commit(o)}
                        onMouseEnter={() => setActive(i)}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-[14.5px] transition-colors ${
                          i === active
                            ? "bg-forest-50 text-ink-900"
                            : "text-ink-700 hover:bg-bone-100"
                        } ${selected ? "font-bold" : "font-medium"}`}
                      >
                        {o}
                        {selected && <Check className="h-4 w-4 shrink-0 text-forest-500" />}
                      </button>
                    </li>
                  );
                })
              )}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      {error && (
        <p role="alert" className="text-[13px] font-semibold text-clay-400">
          {error}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Multi-select version, for vendor coverage areas                     */
/* ------------------------------------------------------------------ */

export function MultiCombobox({
  label,
  hint,
  options,
  selected,
  onToggle,
  onClear,
  error,
  placeholder = "Search and pick as many as apply…",
}: {
  label: string;
  hint?: string;
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear?: () => void;
  error?: string;
  placeholder?: string;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const matches = useMemo(
    () =>
      options
        .map((o) => ({ o, s: score(o, query) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.o),
    [options, query],
  );

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  return (
    <div className="flex flex-col gap-2" ref={wrap}>
      <label htmlFor={id} className="text-[13px] font-bold text-ink-800">
        {label}
      </label>
      {hint && <p className="-mt-1 text-[13px] leading-snug text-ink-400">{hint}</p>}

      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => onToggle(s)}
                aria-label={`Remove ${s}`}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-forest-500 py-1 pl-3.5 pr-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-forest-600"
              >
                {s}
                <Close className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
          {onClear && selected.length > 1 && (
            <li>
              <button
                type="button"
                onClick={onClear}
                className="inline-flex min-h-[36px] items-center rounded-full px-3 text-[13px] font-bold text-ink-400 underline underline-offset-4 transition-colors hover:text-ink-800"
              >
                Clear all
              </button>
            </li>
          )}
        </ul>
      )}

      <div className="relative">
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(matches.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter" && open && matches[active]) {
              e.preventDefault();
              onToggle(matches[active]);
              setQuery("");
            } else if (e.key === "Escape" && open) {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
            }
          }}
          className={`${inputBase} pr-11 ${
            error ? "border-clay-400/70" : "border-bone-200"
          }`}
        />
        <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />

        <AnimatePresence>
          {open && (
            <motion.ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={label}
              aria-multiselectable
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: [0.22, 0.72, 0.18, 1] }}
              className="absolute z-30 mt-1.5 max-h-[min(280px,40svh)] w-full overflow-y-auto overscroll-contain rounded-xl border-[1.5px] border-bone-200 bg-white p-1 shadow-lift"
            >
              {matches.length === 0 ? (
                <li className="px-3 py-3 text-[13.5px] text-ink-400">No match.</li>
              ) : (
                matches.map((o, i) => {
                  const on = selected.includes(o);
                  return (
                    <li key={o} data-index={i}>
                      <button
                        type="button"
                        id={`${id}-opt-${i}`}
                        role="option"
                        aria-selected={on}
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={() => {
                          onToggle(o);
                          setQuery("");
                          setActive(0);
                        }}
                        onMouseEnter={() => setActive(i)}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-[14.5px] transition-colors ${
                          i === active ? "bg-forest-50 text-ink-900" : "text-ink-700 hover:bg-bone-100"
                        } ${on ? "font-bold" : "font-medium"}`}
                      >
                        {o}
                        <span
                          aria-hidden
                          className={`grid h-4.5 w-4.5 shrink-0 place-items-center rounded border-[1.5px] ${
                            on ? "border-forest-500 bg-forest-500" : "border-bone-300"
                          }`}
                        >
                          {on && <Check className="h-3 w-3 text-white" />}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      {error && (
        <p role="alert" className="text-[13px] font-semibold text-clay-400">
          {error}
        </p>
      )}
    </div>
  );
}
