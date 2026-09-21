"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
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
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** 0–1. Renders the hairline progress bar under the header. */
  progress?: number;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  /* Lock the page behind the sheet without the layout jumping. */
  useEffect(() => {
    if (!open) return;
    const { body } = document;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = body.style.overflow;
    const prevPad = body.style.paddingRight;
    body.style.overflow = "hidden";
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPad;
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

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6">
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
            initial={{ opacity: 0, y: 40, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.99 }}
            transition={{ type: "spring", stiffness: 380, damping: 34, mass: 0.9 }}
            className="relative flex max-h-[94svh] w-full flex-col overflow-hidden rounded-t-[26px] bg-bone-100 shadow-lift-lg sm:max-h-[88svh] sm:max-w-[640px] sm:rounded-[26px]"
          >
            {/* grab handle, phone only */}
            <div
              aria-hidden
              className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-bone-300 sm:hidden"
            />

            <header className="shrink-0 px-5 pb-4 pt-4 sm:px-8 sm:pt-7">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-display text-[22px] font-bold leading-tight tracking-[-0.015em] text-ink-900 sm:text-[26px]">
                    {title}
                  </h2>
                  {subtitle && (
                    <p className="mt-1 text-[14px] leading-snug text-ink-400">
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
                <div className="mt-5 h-1 overflow-hidden rounded-full bg-bone-200">
                  <motion.div
                    className="h-full rounded-full bg-forest-500"
                    initial={false}
                    animate={{ width: `${Math.round(progress * 100)}%` }}
                    transition={{ type: "spring", stiffness: 260, damping: 32 }}
                  />
                </div>
              )}
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 sm:px-8">
              {children}
            </div>

            {footer && (
              <footer className="shrink-0 border-t border-bone-200 bg-bone-50/90 px-5 py-4 backdrop-blur sm:px-8">
                {footer}
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
