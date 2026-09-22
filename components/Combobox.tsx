"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Popover } from "./Popover";
import { Check, Close, Search } from "./Icons";

const field =
  "w-full rounded-2xl border-[1.5px] bg-bone-50 px-4 py-3.5 text-[16px] leading-normal text-ink-800 " +
  "placeholder:text-ink-300 transition-[border-color,box-shadow,background-color] duration-200 " +
  "hover:border-bone-300 focus:border-forest-500 focus:bg-white focus:outline-none " +
  "focus:ring-4 focus:ring-forest-500/14 min-h-[56px]";

const borderFor = (error?: string) => (error ? "border-clay-400/70" : "border-bone-200");

function score(option: string, query: string): number {
  const o = option.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return 1;
  if (o === q) return 1000;
  if (o.startsWith(q)) return 500 - o.length;
  if (o.split(/[\s\-/(]+/).some((w) => w.startsWith(q))) return 300 - o.length;
  if (o.includes(q)) return 100 - o.length;
  return 0;
}

function Label({
  htmlFor,
  children,
  optional,
  hint,
}: {
  htmlFor: string;
  children: React.ReactNode;
  optional?: boolean;
  hint?: string;
}) {
  return (
    <>
      <label htmlFor={htmlFor} className="flex items-baseline gap-2 text-[14px] font-bold text-ink-800">
        {children}
        {optional && (
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-300">
            optional
          </span>
        )}
      </label>
      {hint && <p className="-mt-1 text-[13.5px] leading-snug text-ink-400">{hint}</p>}
    </>
  );
}

function OptionRow({
  id,
  label,
  selected,
  active,
  multi,
  onPick,
  onHover,
}: {
  id: string;
  label: string;
  selected: boolean;
  active: boolean;
  multi?: boolean;
  onPick: () => void;
  onHover: () => void;
}) {
  return (
    <button
      type="button"
      id={id}
      role="option"
      aria-selected={selected}
      onPointerDown={(e) => e.preventDefault()}
      onClick={onPick}
      onMouseEnter={onHover}
      className={`flex min-h-[52px] w-full items-center justify-between gap-3 rounded-xl px-3.5 text-left text-[15.5px] transition-colors ${
        active ? "bg-forest-50 text-ink-900" : "text-ink-700"
      } ${selected ? "font-bold" : "font-medium"}`}
    >
      <span className="min-w-0 truncate">{label}</span>
      {multi ? (
        <span
          aria-hidden
          className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-[1.5px] ${
            selected ? "border-forest-500 bg-forest-500" : "border-bone-300"
          }`}
        >
          {selected && <Check className="h-3 w-3 text-white" />}
        </span>
      ) : (
        selected && <Check className="h-4 w-4 shrink-0 text-forest-500" />
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Single select                                                       */
/* ------------------------------------------------------------------ */

export function Combobox({
  label,
  value,
  onChange,
  options,
  placeholder = "Choose one",
  hint,
  error,
  optional,
  disabled,
  disabledHint,
  allowCustom = false,
  /** Force the search box on or off. Defaults to on past eight options. */
  searchable,
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
  searchable?: boolean;
  emptyMessage?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const withSearch = searchable ?? options.length > 8;

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
    if (open && withSearch) searchInput.current?.focus();
  }, [open, withSearch]);

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const commit = (next: string) => {
    onChange(next);
    close();
    trigger.current?.focus();
  };

  /* Nothing to pick from — a plain field is more honest than an empty list. */
  if (options.length === 0 || disabled) {
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor={id} optional={optional} hint={disabled && disabledHint ? disabledHint : hint}>
          {label}
        </Label>
        <input
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder={disabled ? "" : placeholder}
          aria-invalid={error ? true : undefined}
          className={`${field} ${borderFor(error)} disabled:cursor-not-allowed disabled:bg-bone-200/50 disabled:text-ink-300`}
        />
        {error && (
          <p role="alert" className="text-[13.5px] font-semibold text-clay-400">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} optional={optional} hint={hint}>
        {label}
      </Label>

      <button
        id={id}
        ref={trigger}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-invalid={error ? true : undefined}
        onClick={() => {
          setOpen((o) => !o);
          setQuery("");
          setActive(Math.max(0, options.indexOf(value)));
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "Enter") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={`${field} ${borderFor(error)} flex items-center justify-between gap-3 text-left ${
          open ? "border-forest-500 bg-white ring-4 ring-forest-500/14" : ""
        }`}
      >
        <span className={`min-w-0 truncate ${value ? "text-ink-800" : "text-ink-300"}`}>
          {value || placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {value && (
            <span
              role="button"
              tabIndex={-1}
              aria-label={`Clear ${label}`}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="grid h-7 w-7 place-items-center rounded-full text-ink-300 transition-colors hover:bg-bone-200 hover:text-ink-700"
            >
              <Close className="h-3.5 w-3.5" />
            </span>
          )}
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className={`h-4 w-4 text-ink-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          >
            <path d="M6 9.5 12 15l6-5.5" />
          </svg>
        </span>
      </button>

      <Popover open={open} anchorRef={trigger} onDismiss={close} labelledBy={id}>
        <div className="flex max-h-[inherit] flex-col">
          {withSearch && (
            <div className="shrink-0 border-b border-bone-200 p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
                <input
                  ref={searchInput}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                    if (allowCustom) onChange(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setActive((i) => Math.min(matches.length - 1, i + 1));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setActive((i) => Math.max(0, i - 1));
                    } else if (e.key === "Enter" && matches[active]) {
                      e.preventDefault();
                      commit(matches[active]);
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      e.stopPropagation();
                      close();
                    }
                  }}
                  placeholder={`Search ${label.toLowerCase()}`}
                  aria-label={`Search ${label}`}
                  className="min-h-[48px] w-full rounded-xl border-[1.5px] border-bone-200 bg-bone-50 py-2 pl-9 pr-3 text-[15.5px] outline-none focus:border-forest-500"
                />
              </div>
            </div>
          )}
          <ul
            ref={list}
            role="listbox"
            aria-label={label}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5"
          >
            {matches.length === 0 ? (
              <li className="px-3 py-4 text-[14px] leading-snug text-ink-400">
                {allowCustom ? emptyMessage : "No match."}
              </li>
            ) : (
              matches.map((o, i) => (
                <li key={o} data-i={i}>
                  <OptionRow
                    id={`${id}-o${i}`}
                    label={o}
                    selected={o === value}
                    active={i === active}
                    onPick={() => commit(o)}
                    onHover={() => setActive(i)}
                  />
                </li>
              ))
            )}
          </ul>
        </div>
      </Popover>

      {error && (
        <p role="alert" className="text-[13.5px] font-semibold text-clay-400">
          {error}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Multi select                                                        */
/* ------------------------------------------------------------------ */

export function MultiCombobox({
  label,
  hint,
  options,
  selected,
  onToggle,
  onClear,
  error,
  placeholder = "Search and pick as many as apply",
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

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
    if (open) searchInput.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} hint={hint}>
        {label}
      </Label>

      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => onToggle(s)}
                aria-label={`Remove ${s}`}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-forest-500 py-1 pl-4 pr-3 text-[14px] font-semibold text-white transition-colors hover:bg-forest-600"
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
                className="inline-flex min-h-[40px] items-center rounded-full px-3 text-[13.5px] font-bold text-ink-400 underline underline-offset-4 transition-colors hover:text-ink-800"
              >
                Clear all
              </button>
            </li>
          )}
        </ul>
      )}

      <button
        id={id}
        ref={trigger}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-invalid={error ? true : undefined}
        onClick={() => {
          setOpen((o) => !o);
          setQuery("");
          setActive(0);
        }}
        className={`${field} ${borderFor(error)} flex items-center justify-between gap-3 text-left ${
          open ? "border-forest-500 bg-white ring-4 ring-forest-500/14" : ""
        }`}
      >
        <span className="min-w-0 truncate text-ink-300">
          {selected.length > 0 ? "Add another" : placeholder}
        </span>
        <Search className="h-4 w-4 shrink-0 text-ink-300" />
      </button>

      <Popover
        open={open}
        anchorRef={trigger}
        onDismiss={() => {
          setOpen(false);
          setQuery("");
        }}
        labelledBy={id}
      >
        <div className="flex max-h-[inherit] flex-col">
          <div className="shrink-0 border-b border-bone-200 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
              <input
                ref={searchInput}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((i) => Math.min(matches.length - 1, i + 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((i) => Math.max(0, i - 1));
                  } else if (e.key === "Enter" && matches[active]) {
                    e.preventDefault();
                    onToggle(matches[active]);
                    setQuery("");
                    setActive(0);
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpen(false);
                  }
                }}
                placeholder={`Search ${label.toLowerCase()}`}
                aria-label={`Search ${label}`}
                className="min-h-[48px] w-full rounded-xl border-[1.5px] border-bone-200 bg-bone-50 py-2 pl-9 pr-3 text-[15.5px] outline-none focus:border-forest-500"
              />
            </div>
          </div>
          <ul
            ref={list}
            role="listbox"
            aria-label={label}
            aria-multiselectable
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5"
          >
            {matches.length === 0 ? (
              <li className="px-3 py-4 text-[14px] text-ink-400">No match.</li>
            ) : (
              matches.map((o, i) => (
                <li key={o} data-i={i}>
                  <OptionRow
                    id={`${id}-o${i}`}
                    label={o}
                    selected={selected.includes(o)}
                    active={i === active}
                    multi
                    onPick={() => {
                      onToggle(o);
                      setQuery("");
                      setActive(0);
                    }}
                    onHover={() => setActive(i)}
                  />
                </li>
              ))
            )}
          </ul>
        </div>
      </Popover>

      {error && (
        <p role="alert" className="text-[13.5px] font-semibold text-clay-400">
          {error}
        </p>
      )}
    </div>
  );
}
