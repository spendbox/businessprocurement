"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { COUNTRIES, countryByName } from "@/lib/geo";
import { Check, Search } from "./Icons";

/**
 * Phone number with its dialling code picked separately, so the stored
 * value is always complete and unambiguous (+234 801 234 5678).
 *
 * The code defaults to whatever country was chosen for delivery earlier in
 * the form, and follows it until the person overrides it by hand.
 */
export function PhoneField({
  label = "Phone",
  value,
  onChange,
  countryName,
  hint,
  error,
}: {
  label?: string;
  /** Full number including the dialling code. */
  value: string;
  onChange: (value: string) => void;
  /** Country chosen elsewhere in the form; drives the default code. */
  countryName?: string;
  hint?: string;
  error?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [touchedCode, setTouchedCode] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  const fromCountry = countryName ? countryByName(countryName) : undefined;

  /** Split "+234 801 234 5678" into its code and the rest. */
  const { dial, local } = useMemo(() => {
    const trimmed = value.trim();
    if (trimmed.startsWith("+")) {
      // Longest dialling code that matches wins (+1 vs +234).
      const hit = [...COUNTRIES]
        .sort((a, b) => b.dial.length - a.dial.length)
        .find((c) => trimmed.startsWith(c.dial));
      if (hit) {
        return { dial: hit.dial, local: trimmed.slice(hit.dial.length).trim() };
      }
    }
    return { dial: fromCountry?.dial ?? "+234", local: trimmed };
  }, [value, fromCountry]);

  /* Follow the delivery country until the person picks a code themselves. */
  useEffect(() => {
    if (touchedCode || !fromCountry) return;
    if (dial !== fromCountry.dial) {
      onChange(`${fromCountry.dial} ${local}`.trim());
    }
    // `local` is derived from `value`, so this settles in one pass.
  }, [fromCountry, touchedCode, dial, local, onChange]);

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

  const matches = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dial.includes(q.replace(/^\+?/, "+")) ||
        c.dial.replace("+", "").startsWith(q.replace(/\D/g, "")),
    );
  }, [query]);

  const active = COUNTRIES.find((c) => c.dial === dial);
  const placeholder = active?.example ?? "801 234 5678";

  const setDial = (next: string) => {
    setTouchedCode(true);
    onChange(`${next} ${local}`.trim());
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="flex flex-col gap-2" ref={wrap}>
      <label htmlFor={id} className="text-[13px] font-bold text-ink-800">
        {label}
      </label>
      {hint && <p className="-mt-1 text-[13px] leading-snug text-ink-400">{hint}</p>}

      <div
        className={`relative flex min-h-[50px] items-stretch rounded-xl border-[1.5px] bg-bone-50 transition-[border-color,box-shadow,background-color] duration-200 focus-within:border-forest-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-forest-500/14 ${
          error ? "border-clay-400/70" : "border-bone-200"
        }`}
      >
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            setQuery("");
          }}
          aria-label={`Country code, currently ${dial}${active ? ` for ${active.name}` : ""}`}
          aria-expanded={open}
          className="flex shrink-0 items-center gap-1.5 rounded-l-[10px] border-r-[1.5px] border-bone-200 px-3.5 text-[15px] font-bold text-ink-800 transition-colors hover:bg-bone-200/60"
        >
          {dial}
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className={`h-3.5 w-3.5 text-ink-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
          >
            <path d="M6 9.5 12 15l6-5.5" />
          </svg>
        </button>

        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={local}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/[^\d\s()-]/g, "");
            onChange(`${dial} ${cleaned}`.trim());
          }}
          className="min-w-0 flex-1 bg-transparent px-4 text-[15px] text-ink-800 outline-none placeholder:text-ink-300"
        />

        <AnimatePresence>
          {open && (
            <motion.ul
              role="listbox"
              aria-label="Country dialling code"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: [0.22, 0.72, 0.18, 1] }}
              className="absolute left-0 top-[calc(100%+6px)] z-30 max-h-[min(300px,42svh)] w-full min-w-[260px] overflow-y-auto overscroll-contain rounded-xl border-[1.5px] border-bone-200 bg-white p-1 shadow-lift"
            >
              <li className="sticky top-0 z-10 bg-white p-1">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search country or code"
                    aria-label="Search country or dialling code"
                    className="w-full rounded-lg border-[1.5px] border-bone-200 bg-bone-50 py-2 pl-9 pr-3 text-[14px] outline-none focus:border-forest-500"
                  />
                </div>
              </li>
              {matches.map((c) => (
                <li key={c.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={c.dial === dial}
                    onClick={() => setDial(c.dial)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-[14.5px] transition-colors hover:bg-bone-100 ${
                      c.dial === dial ? "font-bold text-ink-900" : "font-medium text-ink-700"
                    }`}
                  >
                    <span className="truncate">{c.name}</span>
                    <span className="flex shrink-0 items-center gap-2 tabular-nums text-ink-400">
                      {c.dial}
                      {c.dial === dial && <Check className="h-4 w-4 text-forest-500" />}
                    </span>
                  </button>
                </li>
              ))}
              {matches.length === 0 && (
                <li className="px-3 py-3 text-[13.5px] text-ink-400">No match.</li>
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
