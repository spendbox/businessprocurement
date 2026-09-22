"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";

/**
 * A panel that escapes whatever it is nested inside.
 *
 * Dropdowns used to render inside the form sheet, so a long list was clipped
 * by the sheet's own scroll area and the whole thing felt boxed in. This
 * portals the panel to <body> and positions it against the trigger in
 * viewport coordinates, measuring the *visual* viewport so the keyboard is
 * treated as the bottom of the screen rather than the page.
 *
 * It flips above the trigger when there is more room up there, never
 * overflows the sides, and closes on scroll of anything behind it.
 */

const GAP = 8;
const EDGE = 12;
/** Never sit closer than this to the keyboard or the bottom of the screen. */
const BOTTOM_SAFE = 12;

type Box = { top: number; left: number; width: number; maxHeight: number; placement: "below" | "above" };

function measure(anchor: HTMLElement, desiredMax: number): Box {
  const rect = anchor.getBoundingClientRect();
  const vv = window.visualViewport;
  const viewTop = vv ? vv.offsetTop : 0;
  const viewHeight = vv ? vv.height : window.innerHeight;
  const viewWidth = vv ? vv.width : window.innerWidth;
  const viewBottom = viewTop + viewHeight;

  const spaceBelow = viewBottom - rect.bottom - GAP - BOTTOM_SAFE;
  const spaceAbove = rect.top - viewTop - GAP - EDGE;

  // Prefer below; flip only when below is cramped and above is roomier.
  const below = spaceBelow >= Math.min(desiredMax, 200) || spaceBelow >= spaceAbove;
  const maxHeight = Math.max(140, Math.min(desiredMax, below ? spaceBelow : spaceAbove));

  const width = Math.max(rect.width, 220);
  let left = rect.left;
  if (left + width > viewWidth - EDGE) left = viewWidth - EDGE - width;
  if (left < EDGE) left = EDGE;

  return {
    top: below ? rect.bottom + GAP : rect.top - GAP - maxHeight,
    left,
    width: Math.min(width, viewWidth - EDGE * 2),
    maxHeight,
    placement: below ? "below" : "above",
  };
}

export function Popover({
  open,
  anchorRef,
  onDismiss,
  children,
  desiredMaxHeight = 320,
  labelledBy,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onDismiss: () => void;
  children: ReactNode;
  desiredMaxHeight?: number;
  labelledBy?: string;
}) {
  const [box, setBox] = useState<Box | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setBox(null);
      return;
    }
    const update = () => {
      if (anchorRef.current) setBox(measure(anchorRef.current, desiredMaxHeight));
    };
    update();

    const vv = window.visualViewport;
    window.addEventListener("resize", update);
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    // Any scroll behind the panel invalidates its position; close rather than
    // let it drift away from the field it belongs to.
    const onScroll = (e: Event) => {
      if (panel.current?.contains(e.target as Node)) return;
      onDismiss();
    };
    document.addEventListener("scroll", onScroll, true);

    return () => {
      window.removeEventListener("resize", update);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [open, anchorRef, desiredMaxHeight, onDismiss]);

  /* Clicking anywhere that is neither the panel nor the trigger closes it. */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panel.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onDismiss();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open, anchorRef, onDismiss]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && box && (
        <motion.div
          ref={panel}
          aria-labelledby={labelledBy}
          initial={{ opacity: 0, y: box.placement === "below" ? -6 : 6, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: box.placement === "below" ? -6 : 6, scale: 0.99 }}
          transition={{ duration: 0.16, ease: [0.22, 0.72, 0.18, 1] }}
          style={{
            position: "fixed",
            top: box.top,
            left: box.left,
            width: box.width,
            maxHeight: box.maxHeight,
            zIndex: 120,
          }}
          className="overflow-hidden rounded-2xl border-[1.5px] border-bone-200 bg-white shadow-lift-lg"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
