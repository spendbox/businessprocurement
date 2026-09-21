"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Paperclip, Search } from "./Icons";
import { useShell } from "./Shell";

/** Placeholders rotate with the chapter you are looking at. */
export const PLACEHOLDERS: string[][] = [
  [
    "50 ergonomic office chairs, delivered to Ikeja",
    "200 boxes of nitrile gloves, size M",
    "10 laptops for a new branch office",
  ],
  [
    "Paste your purchase order here",
    "Monthly janitorial supply for 3 floors",
    "Branded packaging for 5,000 units",
  ],
  [
    "40kVA soundproof generator, installed",
    "600 bags of cement to a site in Abuja",
    "150 branded polo shirts, embroidered",
  ],
  [
    "Tiles and adhesive for 400 sqm",
    "Weekly water and coffee for 60 staff",
    "Two delivery vans, financed or outright",
  ],
  [
    "Tell us what you need — we do the rest",
    "Type it the way you would say it",
    "No account needed to ask",
  ],
];

function useRotatingPlaceholder(pool: string[], paused: boolean) {
  const [index, setIndex] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    setIndex(0);
  }, [pool]);

  useEffect(() => {
    if (paused || reduced || pool.length < 2) return;
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % pool.length),
      3600,
    );
    return () => window.clearInterval(id);
  }, [pool, paused, reduced]);

  return pool[index] ?? pool[0] ?? "";
}

/**
 * The one control that never leaves the screen.
 *
 * It is a real focusable input so screen readers and keyboards treat it as
 * the primary action, but it does not hold text itself: the first click or
 * keystroke carries you — and that keystroke — into the request form, which
 * is where the typing actually happens.
 */
export function CommandBar({
  chapter = 0,
  compact = false,
}: {
  chapter?: number;
  compact?: boolean;
}) {
  const { openOrder } = useShell();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pool = PLACEHOLDERS[chapter] ?? PLACEHOLDERS[0];
  const placeholder = useRotatingPlaceholder(pool, false);

  const start = (seed?: string) => {
    openOrder(seed ? { need: seed } : undefined);
    inputRef.current?.blur();
  };

  return (
    <div className="w-full">
      <div
        onClick={() => start()}
        className={`group relative flex w-full cursor-text items-center gap-2 rounded-full border-[1.5px] border-bone-200 bg-white shadow-lift transition-[box-shadow,border-color,transform] duration-300 hover:-translate-y-px hover:border-bone-300 hover:shadow-lift-lg ${
          focused ? "border-forest-500 ring-4 ring-forest-500/14" : ""
        } ${compact ? "h-[58px] pl-4 pr-1.5" : "h-[62px] pl-5 pr-2 sm:h-[72px] sm:pl-6"}`}
      >
        <Search
          className={`shrink-0 transition-colors ${
            focused ? "text-forest-500" : "text-ink-300"
          } ${compact ? "h-[18px] w-[18px]" : "h-5 w-5"}`}
        />

        <div className="relative min-w-0 flex-1">
          {/*
            readOnly keeps the mobile keyboard from opening behind the sheet
            and keeps this field from becoming a second place to type.
          */}
          <input
            ref={inputRef}
            readOnly
            value=""
            onChange={() => {}}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                start();
              } else if (
                e.key.length === 1 &&
                !e.metaKey &&
                !e.ctrlKey &&
                !e.altKey
              ) {
                // Carry the first character into the form so nothing is lost.
                e.preventDefault();
                start(e.key);
              }
            }}
            aria-label="What does your business need to buy? Opens a short request form."
            enterKeyHint="go"
            autoComplete="off"
            className={`w-full cursor-text bg-transparent text-ink-800 caret-forest-500 outline-none ${
              compact ? "text-[15px]" : "text-[15.5px] sm:text-[17px]"
            }`}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center overflow-hidden"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={placeholder}
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -16, opacity: 0 }}
                transition={{ duration: 0.38, ease: [0.22, 0.72, 0.18, 1] }}
                className={`block truncate text-ink-300 ${
                  compact ? "text-[15px]" : "text-[15.5px] sm:text-[17px]"
                }`}
              >
                {placeholder}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        {!compact && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              start();
            }}
            aria-label="Attach a purchase order or spreadsheet instead"
            className="hidden h-11 w-11 shrink-0 place-items-center rounded-full text-ink-300 transition-colors hover:bg-bone-100 hover:text-ink-700 sm:grid"
          >
            <Paperclip className="h-[18px] w-[18px]" />
          </button>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            start();
          }}
          aria-label="Start your request"
          className={`grid shrink-0 place-items-center rounded-full bg-forest-500 text-white transition-[background-color,transform] duration-200 hover:bg-forest-600 group-hover:translate-x-0.5 ${
            compact ? "h-11 w-11" : "h-[46px] w-[46px] sm:h-14 sm:w-14"
          }`}
        >
          <ArrowRight className={compact ? "h-[18px] w-[18px]" : "h-5 w-5"} />
        </button>

        {/* slow breathing ring — marks this as the thing to use */}
        {!compact && (
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-[7px] rounded-full border-[1.5px] border-forest-500/35 opacity-0 motion-safe:animate-[breathe_4s_ease-in-out_1.4s_infinite]"
          />
        )}
      </div>

      <style>{`@keyframes breathe{0%{opacity:0;transform:scale(.985)}35%{opacity:1}70%{opacity:0;transform:scale(1.025)}100%{opacity:0}}`}</style>
    </div>
  );
}
