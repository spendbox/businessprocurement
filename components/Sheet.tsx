"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useVisualViewport } from "@/lib/useVisualViewport";
import { Close } from "./Icons";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  progress,
  children,
  footer,
  /** Changing this scrolls the body back to the top — one per step. */
  scrollKey,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  progress?: number;
  children: ReactNode;
  footer?: ReactNode;
  scrollKey?: string | number;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  // The keyboard covers the bottom of the screen without changing the layout
  // viewport, so the sheet is sized and placed against the visual viewport.
  const viewport = useVisualViewport(open);

  /* Lock the page behind the sheet without the layout jumping. */
  useEffect(() => {
    if (!open) return;
    const { body: pageBody } = document;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = pageBody.style.overflow;
    const prevPad = pageBody.style.paddingRight;
    pageBody.style.overflow = "hidden";
    if (gap > 0) pageBody.style.paddingRight = `${gap}px`;
    return () => {
      pageBody.style.overflow = prevOverflow;
      pageBody.style.paddingRight = prevPad;
    };
  }, [open]);

  /* Escape to close, Tab kept inside, focus returned on exit. */
  useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const nodes = Array.from(
        panel.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((n) => n.offsetParent !== null);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      restoreTo.current?.focus?.();
    };
  }, [open, onClose]);

  /* New step — start at the top of it rather than mid-scroll. */
  useEffect(() => {
    body.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [scrollKey]);

  /*
   * Keep whatever is focused comfortably above the keyboard. Focus events
   * bubble here from any field in the sheet, so this covers every input
   * without each one wiring it up.
   */
  const onFocusIn = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (!target.matches("input, textarea, select, [role='combobox']")) return;
    window.setTimeout(() => {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 120);
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-x-0 z-[90] flex items-end justify-center sm:items-center sm:p-6"
          style={
            viewport
              ? { top: viewport.top, height: viewport.height }
              : { top: 0, bottom: 0 }
          }
        >
          <motion.button
            type="button"
            aria-label="Close"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 cursor-default bg-ink-900/45 backdrop-blur-[3px]"
          />

          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onFocus={onFocusIn}
            initial={{ opacity: 0, y: 40, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.99 }}
            transition={{ type: "spring", stiffness: 380, damping: 34, mass: 0.9 }}
            /*
             * Height is capped against the visual viewport so the footer
             * button always sits just above the keyboard, never behind it.
             */
            style={{ maxHeight: viewport ? viewport.height - 8 : undefined }}
            className="relative flex max-h-[94svh] w-full flex-col overflow-hidden rounded-t-[26px] bg-bone-100 shadow-lift-lg sm:max-h-[88svh] sm:max-w-[640px] sm:rounded-[26px]"
          >
            <div
              aria-hidden
              className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-bone-300 sm:hidden"
            />

            <header className="shrink-0 px-5 pb-4 pt-3.5 sm:px-8 sm:pt-7">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-display text-[21px] font-bold leading-tight tracking-[-0.015em] text-ink-900 sm:text-[26px]">
                    {title}
                  </h2>
                  {subtitle && (
                    <p className="mt-1 text-[13.5px] leading-snug text-ink-400 sm:text-[14px]">
                      {subtitle}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-bone-200 text-ink-500 transition-colors hover:bg-bone-300 hover:text-ink-800"
                >
                  <Close className="h-4.5 w-4.5" />
                </button>
              </div>

              {typeof progress === "number" && (
                <div className="mt-4 h-1 overflow-hidden rounded-full bg-bone-200 sm:mt-5">
                  <motion.div
                    className="h-full rounded-full bg-forest-500"
                    initial={false}
                    animate={{ width: `${Math.round(progress * 100)}%` }}
                    transition={{ type: "spring", stiffness: 260, damping: 32 }}
                  />
                </div>
              )}
            </header>

            <div
              ref={body}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth px-5 pb-8 [scroll-padding-bottom:6rem] sm:px-8"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {children}
            </div>

            {footer && (
              <footer className="shrink-0 border-t border-bone-200 bg-bone-50/95 px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-8 sm:py-4">
                {footer}
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
