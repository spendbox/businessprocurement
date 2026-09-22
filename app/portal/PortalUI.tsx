"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell, useShell } from "@/components/Shell";
import { ArrowRight, Chevron } from "@/components/Icons";

/** Opens the request form, prefilled so a known business does not retype. */
function NewRequestButton({
  company,
  contactName,
  email,
  full,
}: {
  company: string;
  contactName: string;
  email: string;
  full?: boolean;
}) {
  const { openOrder } = useShell();
  return (
    <button
      type="button"
      onClick={() => openOrder({ company, contactName, email })}
      className={`group inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-full bg-forest-500 px-6 text-[15.5px] font-bold text-white transition-all duration-200 hover:bg-forest-600 ${
        full ? "w-full" : ""
      }`}
    >
      New request
      <ArrowRight className="h-4.5 w-4.5 transition-transform group-hover:translate-x-1" />
    </button>
  );
}

export function PortalShell({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}

export function NewRequest(props: {
  company: string;
  contactName: string;
  email: string;
  full?: boolean;
}) {
  return <NewRequestButton {...props} />;
}

export function SignOut() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/portal/logout", { method: "POST" });
        router.replace("/portal/login");
        router.refresh();
      }}
      className="rounded-full px-3 py-2 text-[13.5px] font-semibold text-ink-400 transition-colors hover:bg-bone-200 hover:text-ink-900"
    >
      Sign out
    </button>
  );
}

/** A request card that opens to show the full detail. */
export function RequestCard({
  reference,
  need,
  createdAt,
  statusLabel,
  statusDetail,
  step,
  urgency,
  details,
}: {
  reference: string;
  need: string;
  createdAt: string;
  statusLabel: string;
  statusDetail: string;
  step: number;
  urgency: string;
  details: { label: string; value: string }[];
}) {
  const [open, setOpen] = useState(false);
  const stages = ["Received", "Sourcing", "Offers ready", "Ordered"];

  return (
    <li className="overflow-hidden rounded-2xl border border-bone-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-bone-50 sm:p-5"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-forest-50 px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-wide text-forest-700">
              {statusLabel}
            </span>
            <span className="font-mono text-[12px] text-ink-300">{reference}</span>
          </span>
          <span className="mt-2 block text-[15.5px] font-bold leading-snug text-ink-900">
            {need}
          </span>
          <span className="mt-1 block text-[13px] text-ink-400">
            {createdAt} · {urgency}
          </span>
        </span>
        <Chevron
          className={`mt-1 h-4.5 w-4.5 shrink-0 text-ink-400 transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="border-t border-bone-200 px-4 pb-5 pt-4 sm:px-5">
          {step > 0 && (
            <ol className="mb-5 flex gap-1.5" aria-label="Progress">
              {stages.map((stage, i) => (
                <li key={stage} className="flex-1">
                  <span
                    aria-hidden
                    className={`block h-1.5 rounded-full ${
                      i < step ? "bg-forest-500" : "bg-bone-200"
                    }`}
                  />
                  <span
                    className={`mt-1.5 block text-[10.5px] font-semibold uppercase tracking-wide ${
                      i < step ? "text-forest-700" : "text-ink-300"
                    }`}
                  >
                    {stage}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p className="mb-4 text-[14px] leading-relaxed text-ink-500">{statusDetail}</p>
          <dl className="flex flex-col">
            {details.map((d) => (
              <div key={d.label} className="border-b border-bone-200 py-2.5 last:border-0">
                <dt className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-300">
                  {d.label}
                </dt>
                <dd className="mt-0.5 whitespace-pre-line text-[14.5px] leading-snug text-ink-800">
                  {d.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </li>
  );
}
