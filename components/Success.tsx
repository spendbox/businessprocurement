"use client";

import { motion } from "motion/react";
import { Check } from "./Icons";

export function Success({
  reference,
  email,
  urgency,
  kind = "request",
  confirmationSent = true,
}: {
  reference: string;
  email: string;
  urgency?: string;
  kind?: "request" | "application";
  /** False when the confirmation email could not be sent. */
  confirmationSent?: boolean;
}) {
  const promise =
    kind === "application"
      ? "We review new merchants within two working days, then start sending you matching requests."
      : urgency === "same-day"
        ? "You marked this as needed today, so someone will call you within the hour."
        : urgency === "48-hours"
          ? "You marked this as urgent, so we will come back with offers today."
          : "We will come back with the best offers within 24 hours.";

  return (
    <div className="flex flex-col items-center gap-5 py-6 text-center">
      <motion.span
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 16 }}
        className="grid h-16 w-16 place-items-center rounded-full bg-forest-500 text-white"
      >
        <Check className="h-7 w-7" />
      </motion.span>

      <div>
        <h3 className="font-display text-[24px] font-bold tracking-[-0.015em] text-ink-900">
          {kind === "application" ? "You are on the list" : "We have your request"}
        </h3>
        <p className="mx-auto mt-2 max-w-[42ch] text-[15px] leading-relaxed text-ink-500">
          {promise}
        </p>
      </div>

      <div className="w-full rounded-2xl border border-bone-200 bg-white px-5 py-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-300">
          Your reference
        </p>
        <p className="mt-1 font-mono text-[22px] font-bold tracking-[0.04em] text-ink-900">
          {reference}
        </p>
      </div>

      {confirmationSent ? (
        <p className="max-w-[42ch] text-[13.5px] leading-relaxed text-ink-400">
          A confirmation is on its way to{" "}
          <span className="font-semibold text-ink-700">{email}</span>. If it has
          not landed in a few minutes, check your spam folder.
        </p>
      ) : (
        /* Never promise an email that did not send. */
        <p className="max-w-[44ch] rounded-xl border-[1.5px] border-amber-400/40 bg-amber-400/10 px-4 py-3 text-[13.5px] leading-relaxed text-ink-700">
          We have your {kind === "application" ? "application" : "request"} and our
          team has been notified, but the confirmation email to{" "}
          <span className="font-semibold">{email}</span> did not go through. Keep
          the reference above — it is all we need to find you.
        </p>
      )}

      <a
        href="/portal/login"
        className="text-[13.5px] font-bold text-forest-500 underline decoration-forest-200 decoration-2 underline-offset-4 transition-colors hover:text-forest-600"
      >
        Track this {kind === "application" ? "application" : "request"} any time
      </a>
      <p className="-mt-2 max-w-[40ch] text-[12.5px] leading-relaxed text-ink-300">
        Sign in with this email whenever you like — no password, and never
        required.
      </p>
    </div>
  );
}
