"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Status chips — colour is never the only signal, the word is there   */
/* ------------------------------------------------------------------ */

const STATUS_TONE: Record<string, string> = {
  new: "bg-forest-50 text-forest-700 border-forest-200",
  sourcing: "bg-amber-400/15 text-amber-500 border-amber-400/40",
  quoted: "bg-bone-200 text-ink-700 border-bone-300",
  won: "bg-forest-500 text-white border-forest-500",
  lost: "bg-clay-400/15 text-clay-400 border-clay-400/40",
  cancelled: "bg-bone-200 text-ink-300 border-bone-300",
  pending: "bg-amber-400/15 text-amber-500 border-amber-400/40",
  approved: "bg-forest-500 text-white border-forest-500",
  rejected: "bg-clay-400/15 text-clay-400 border-clay-400/40",
  paused: "bg-bone-200 text-ink-400 border-bone-300",
};

export function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-wide ${
        STATUS_TONE[status] ?? "bg-bone-200 text-ink-500 border-bone-300"
      }`}
    >
      {status}
    </span>
  );
}

const URGENT = new Set(["same-day", "48-hours"]);

export function UrgencyChip({ urgency, label }: { urgency: string; label: string }) {
  const hot = URGENT.has(urgency);
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-bold ${
        hot
          ? "border-clay-400/40 bg-clay-400/12 text-clay-400"
          : "border-bone-300 bg-bone-100 text-ink-500"
      }`}
    >
      {hot && (
        <svg viewBox="0 0 24 24" aria-hidden className="h-3 w-3" fill="currentColor">
          <path d="M12 2 3 14h7l-1 8 9-12h-7z" />
        </svg>
      )}
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Status control                                                      */
/* ------------------------------------------------------------------ */

export function StatusSelect({
  kind,
  id,
  value,
  options,
}: {
  kind: "request" | "vendor";
  id: string;
  value: string;
  options: readonly string[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState(value);
  const [error, setError] = useState<string | null>(null);

  const change = async (next: string) => {
    const previous = current;
    setCurrent(next);
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, status: next }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        setCurrent(previous);
        setError(data?.message ?? "Could not save that.");
        return;
      }
      router.refresh();
    } catch {
      setCurrent(previous);
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <span className="inline-flex flex-col gap-1">
      <select
        value={current}
        disabled={saving}
        onChange={(e) => change(e.target.value)}
        aria-label="Status"
        className="min-h-[40px] rounded-lg border-[1.5px] border-bone-200 bg-white px-3 text-[13.5px] font-semibold text-ink-800 outline-none transition-colors focus:border-forest-500 disabled:opacity-60"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {error && <span className="text-[12px] font-semibold text-clay-400">{error}</span>}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Send to merchants                                                   */
/* ------------------------------------------------------------------ */

export type MatchVendor = {
  id: string;
  company: string;
  email: string;
  contact_name: string;
  categories: string[];
  regions: string[];
  fulfilment_speed: string;
};

export function SendToMerchants({
  requestId,
  vendors,
}: {
  requestId: string;
  vendors: MatchVendor[];
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>(vendors.map((v) => v.id));
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const send = async () => {
    setSending(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, vendorIds: picked, note }),
      });
      const data = await response.json().catch(() => null);
      setResult({
        ok: Boolean(data?.ok),
        message: data?.message ?? "Something went wrong.",
      });
      if (data?.ok) router.refresh();
    } catch {
      setResult({ ok: false, message: "Could not reach the server." });
    } finally {
      setSending(false);
    }
  };

  if (vendors.length === 0) {
    return (
      <p className="rounded-xl border border-bone-200 bg-bone-50 px-4 py-4 text-[14px] leading-relaxed text-ink-500">
        No approved merchant currently supplies these categories and covers this
        location. Approve a matching merchant, or widen an existing one&apos;s
        coverage, and they will appear here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {vendors.map((v) => {
          const on = picked.includes(v.id);
          return (
            <li key={v.id}>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] p-3.5 transition-colors ${
                  on ? "border-forest-500 bg-forest-50" : "border-bone-200 bg-white"
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(v.id)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-forest-500"
                />
                <span className="min-w-0">
                  <span className="block text-[14.5px] font-bold text-ink-900">
                    {v.company}
                  </span>
                  <span className="block truncate text-[13px] text-ink-400">
                    {v.contact_name} · {v.email}
                  </span>
                  <span className="mt-1 block text-[12.5px] text-ink-300">
                    {v.categories.join(", ")} · {v.fulfilment_speed}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-bold text-ink-800">
          Add a note to the merchants{" "}
          <span className="font-semibold text-ink-300">(optional)</span>
        </span>
        <textarea
          value={note}
          rows={3}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Buyer needs delivery to a site with no forklift — include offloading in your price."
          className="w-full rounded-xl border-[1.5px] border-bone-200 bg-white px-4 py-3 text-[14.5px] leading-relaxed outline-none transition-colors focus:border-forest-500"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={send}
          disabled={sending || picked.length === 0}
          className="inline-flex min-h-[46px] items-center gap-2 rounded-full bg-forest-500 px-5 text-[14.5px] font-bold text-white transition-colors hover:bg-forest-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending
            ? "Sending…"
            : `Email ${picked.length} merchant${picked.length === 1 ? "" : "s"}`}
        </button>
        <p className="text-[13px] text-ink-400">
          Buyer contact details are not included in what they receive.
        </p>
      </div>

      {result && (
        <p
          role="status"
          className={`rounded-xl border-[1.5px] px-4 py-3 text-[14px] font-semibold ${
            result.ok
              ? "border-forest-200 bg-forest-50 text-forest-700"
              : "border-clay-400/40 bg-clay-400/10 text-clay-400"
          }`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Internal notes                                                      */
/* ------------------------------------------------------------------ */

export function InternalNotes({ id, value }: { id: string; value: string }) {
  const [notes, setNotes] = useState(value);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/admin/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "request", id, internalNotes: notes }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={notes}
        rows={4}
        onChange={(e) => {
          setNotes(e.target.value);
          setSaved(false);
        }}
        placeholder="Who you called, what they said, which merchant is closest…"
        className="w-full rounded-xl border-[1.5px] border-bone-200 bg-white px-4 py-3 text-[14.5px] leading-relaxed outline-none transition-colors focus:border-forest-500"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex min-h-[42px] items-center rounded-full border-[1.5px] border-ink-900 px-4 text-[14px] font-bold text-ink-900 transition-colors hover:bg-ink-900 hover:text-bone-50 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save notes"}
        </button>
        {saved && <span className="text-[13px] font-semibold text-forest-500">Saved</span>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sign out                                                            */
/* ------------------------------------------------------------------ */

export function SignOut() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/admin/logout", { method: "POST" });
        router.replace("/admin/login");
        router.refresh();
      }}
      className="shrink-0 rounded-full px-3 py-2 text-[13.5px] font-semibold text-ink-400 transition-colors hover:bg-bone-200 hover:text-ink-900"
    >
      Sign out
    </button>
  );
}

export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-bone-200 bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-bone-200 px-5 py-4">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-ink-500">
          {title}
        </h2>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}
