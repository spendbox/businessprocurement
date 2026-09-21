"use client";

import { AnimatePresence, motion } from "motion/react";
import { CommandBar } from "./CommandBar";
import { useShell } from "./Shell";

/**
 * Once the stage has scrolled past, the bar reappears docked to the bottom
 * of the viewport, so it is genuinely never off screen.
 */
export function DockBar() {
  const { docked, anyOpen } = useShell();
  const show = docked && !anyOpen;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 96, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 96, opacity: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 32, mass: 0.8 }}
          className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:pb-5"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-bone-100 via-bone-100/85 to-transparent"
          />
          <div className="mx-auto w-full max-w-[600px]">
            <CommandBar chapter={4} compact />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
