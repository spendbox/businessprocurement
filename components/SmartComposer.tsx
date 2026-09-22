"use client";

import { motion } from "motion/react";
import { urgencyLabel } from "@/lib/catalog";
import { Check, Spark } from "./Icons";
import { FileDrop, type PickedFile } from "./FileDrop";
import type { Understanding } from "@/lib/understand";

/**
 * The one field that replaces a form.
 *
 * People do not want to answer fifteen questions, but a sourcing team still
 * needs fifteen answers. So the prompt teaches as it goes — a short list of
 * what to mention — and a live readout shows which of those things have
 * been picked up, so the writer can see the gap and fill it in their own
 * words rather than being marched through inputs.
 */

/** What we hope to find, in the order it is worth mentioning. */
const WANTED: { key: keyof Understanding; label: string; example: string }[] = [
  { key: "categories", label: "What it is", example: "office chairs" },
  { key: "quantity", label: "How many", example: "50 of them" },
  { key: "city", label: "Where it goes", example: "to Ikeja, Lagos" },
  { key: "budget", label: "Budget", example: "around ₦4m" },
  { key: "urgency", label: "How soon", example: "within two weeks" },
];

const found = (u: Understanding | null, key: keyof Understanding): boolean => {
  if (!u) return false;
  const value = u[key];
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
};

function readable(u: Understanding, key: keyof Understanding): string {
  if (key === "categories") return u.categories.join(", ");
  if (key === "urgency") return urgencyLabel(u.urgency);
  if (key === "city") return [u.city, u.region].filter(Boolean).join(", ");
  const value = u[key];
  return typeof value === "string" ? value : "";
}

export function SmartComposer({
  value,
  onChange,
  files,
  onFilesChange,
  understanding,
  reading,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  files: PickedFile[];
  onFilesChange: (files: PickedFile[]) => void;
  understanding: Understanding | null;
  reading: boolean;
  error?: string;
}) {
  const missing = WANTED.filter((w) => !found(understanding, w.key));
  const gotSomething = understanding && WANTED.some((w) => found(understanding, w.key));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="request-need" className="text-[14px] font-bold text-ink-800">
          What does your business need?
        </label>
        <p className="-mt-1 text-[13.5px] leading-snug text-ink-400">
          Write it the way you would say it on the phone. Mention what it is,
          how many, where it goes, your budget and how soon — in any order.
        </p>
        <textarea
          id="request-need"
          value={value}
          rows={7}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
          aria-invalid={error ? true : undefined}
          placeholder={
            "We need 50 ergonomic office chairs with adjustable arms for our new floor in Ikeja, Lagos.\n\nBudget is around ₦4m and we'd like them within two weeks. Mesh back preferred."
          }
          className={`w-full rounded-2xl border-[1.5px] bg-bone-50 px-4 py-3.5 text-[16px] leading-relaxed text-ink-800 placeholder:text-ink-300 transition-[border-color,box-shadow,background-color] duration-200 hover:border-bone-300 focus:border-forest-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-forest-500/14 ${
            error ? "border-clay-400/70" : "border-bone-200"
          }`}
        />
        {error && (
          <p role="alert" className="text-[13.5px] font-semibold text-clay-400">
            {error}
          </p>
        )}
      </div>

      {/* What we picked up, and what is still missing. */}
      {(reading || gotSomething) && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-bone-200 bg-white p-4"
          aria-live="polite"
        >
          <p className="flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-[0.08em] text-forest-500">
            <Spark className="h-4 w-4 shrink-0" />
            {reading ? "Reading what you wrote…" : "What we picked up"}
          </p>

          <ul className="mt-3 flex flex-col gap-2">
            {WANTED.map((w) => {
              const hit = found(understanding, w.key);
              return (
                <li key={w.key as string} className="flex items-start gap-2.5">
                  <span
                    aria-hidden
                    className={`mt-0.5 grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full ${
                      hit ? "bg-forest-500" : "border-[1.5px] border-bone-300"
                    }`}
                  >
                    {hit && <Check className="h-2.5 w-2.5 text-white" />}
                  </span>
                  <span className="min-w-0 text-[13.5px] leading-snug">
                    <span className={hit ? "text-ink-400" : "font-semibold text-ink-700"}>
                      {w.label}
                    </span>
                    {hit && understanding ? (
                      <span className="ml-1.5 font-semibold text-ink-900">
                        {readable(understanding, w.key)}
                      </span>
                    ) : (
                      <span className="ml-1.5 text-ink-300">— e.g. {w.example}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>

          {!reading && missing.length > 0 && (
            <p className="mt-3 border-t border-bone-200 pt-3 text-[13px] leading-relaxed text-ink-400">
              You can send it as it is — we will ask about anything missing when
              we call. Adding it now is just faster.
            </p>
          )}
        </motion.div>
      )}

      <div className="border-t border-bone-200 pt-4">
        <FileDrop files={files} onChange={onFilesChange} />
      </div>
    </div>
  );
}
