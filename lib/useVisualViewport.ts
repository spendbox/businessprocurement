"use client";

import { useEffect, useState } from "react";

export type ViewportBox = { top: number; height: number };

/**
 * Tracks the *visual* viewport — the part of the screen not covered by the
 * on-screen keyboard.
 *
 * On phones, opening the keyboard does not change the layout viewport, so
 * anything positioned with `bottom: 0` or `100svh` ends up underneath it.
 * Reading `window.visualViewport` and positioning against that is the only
 * reliable fix across iOS Safari and Android Chrome.
 *
 * Returns null until measured, and on browsers without the API, so callers
 * fall back to plain CSS.
 */
export function useVisualViewport(active: boolean): ViewportBox | null {
  const [box, setBox] = useState<ViewportBox | null>(null);

  useEffect(() => {
    if (!active) {
      setBox(null);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;

    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setBox({ top: vv.offsetTop, height: vv.height });
      });
    };

    measure();
    vv.addEventListener("resize", measure);
    vv.addEventListener("scroll", measure);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", measure);
      vv.removeEventListener("scroll", measure);
    };
  }, [active]);

  return box;
}
