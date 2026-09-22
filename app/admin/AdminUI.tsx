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
  draft: "bg-bone-200 text-ink-500 border-bone-300",
  sent: "bg-forest-50 text-forest-700 border-forest-200",
  paid: "bg-forest-500 text-white border-forest-500",
  void: "bg-clay-400/15 text-clay-400 border-clay-400/40",
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
  kind: "request" | "vendor" | "invoice";
  id: string;
  value: string;
  options: readonly string[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState(value);
  const [error, setError] = useState<string | null>(null);
  /* What the change set off — an approval email, a trip to the archive. */
  const [note, setNote] = useState<string | null>(null);

  const change = async (next: string) => {
    const previous = current;
    setCurrent(next);
    setSaving(true);
    setError(null);
    setNote(null);
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
      if (typeof data.message === "string" && data.message) {
        /* An email that failed is reported as a problem, not a success. */
        if (data.emailed === false) setError(data.message);
        else setNote(data.message);
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
      {error && (
        <span role="alert" className="max-w-[34ch] text-[12px] font-semibold text-clay-400">
          {error}
        </span>
      )}
      {note && !error && (
        <span role="status" className="max-w-[34ch] text-[12px] font-semibold text-forest-600">
          {note}
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Deleting a merchant                                                 */
/* ------------------------------------------------------------------ */

/**
 * Two clicks, never one.
 *
 * Deleting a merchant cannot be undone, so the button turns into a plain
 * question first. The dangerous action is the one that needs the deliberate
 * second press, and it says what will disappear.
 */
export function DeleteVendor({
  id,
  company,
}: {
  id: string;
  company: string;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setWorking(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/vendors", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        setError(data?.message ?? "Could not delete that merchant.");
        setWorking(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
      setWorking(false);
    }
  };

  if (!asking) {
    return (
      <span className="inline-flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="inline-flex min-h-[40px] items-center rounded-full border-[1.5px] border-bone-300 px-3.5 text-[13px] font-bold text-ink-400 transition-colors hover:border-clay-400/60 hover:bg-clay-400/10 hover:text-clay-400"
        >
          Delete
        </button>
        {error && (
          <span role="alert" className="text-[12px] font-semibold text-clay-400">
            {error}
          </span>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-end gap-1.5 rounded-xl border-[1.5px] border-clay-400/40 bg-clay-400/8 px-3 py-2.5">
      <span className="text-[13px] font-semibold leading-snug text-ink-700">
        Delete {company} for good?
      </span>
      <span className="flex items-center gap-2">
        <button
          type="button"
          onClick={remove}
          disabled={working}
          className="inline-flex min-h-[38px] items-center rounded-full bg-clay-400 px-3.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {working ? "Deleting…" : "Yes, delete"}
        </button>
        <button
          type="button"
          onClick={() => setAsking(false)}
          disabled={working}
          className="inline-flex min-h-[38px] items-center rounded-full px-3 text-[13px] font-bold text-ink-500 transition-colors hover:text-ink-900"
        >
          Keep
        </button>
      </span>
      {error && (
        <span role="alert" className="text-[12px] font-semibold text-clay-400">
          {error}
        </span>
      )}
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
  score: number;
  reasons: string[];
  gaps: string[];
  recommended: boolean;
};

function Fit({ score }: { score: number }) {
  // Five pips rather than a raw number — the score is a sort order, not a
  // measurement, and showing "87" invites false precision.
  const pips = Math.max(1, Math.min(5, Math.round(score / 28)));
  return (
    <span className="flex shrink-0 items-center gap-1.5" title={`Fit ${pips} of 5`}>
      <span aria-hidden className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <i
            key={n}
            className={`h-1.5 w-1.5 rounded-full ${n <= pips ? "bg-forest-500" : "bg-bone-300"}`}
          />
        ))}
      </span>
      <span className="sr-only">Fit {pips} of 5</span>
    </span>
  );
}

function VendorPick({
  vendor,
  checked,
  onToggle,
}: {
  vendor: MatchVendor;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] p-3.5 transition-colors ${
        checked ? "border-forest-500 bg-forest-50" : "border-bone-200 bg-white hover:border-bone-300"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-0.5 h-5 w-5 shrink-0 accent-forest-500"
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[14.5px] font-bold text-ink-900">{vendor.company}</span>
          <Fit score={vendor.score} />
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-ink-400">
          {vendor.contact_name} · {vendor.email}
        </span>
        {vendor.reasons.length > 0 && (
          <span className="mt-1.5 flex flex-wrap gap-1">
            {vendor.reasons.map((r) => (
              <span
                key={r}
                className="rounded-full bg-forest-50 px-2 py-0.5 text-[11.5px] font-semibold text-forest-700"
              >
                {r}
              </span>
            ))}
          </span>
        )}
        {vendor.gaps.length > 0 && (
          <span className="mt-1 flex flex-wrap gap-1">
            {vendor.gaps.map((g) => (
              <span
                key={g}
                className="rounded-full bg-clay-400/12 px-2 py-0.5 text-[11.5px] font-semibold text-clay-400"
              >
                {g}
              </span>
            ))}
          </span>
        )}
      </span>
    </label>
  );
}

export function SendToMerchants({
  requestId,
  vendors,
}: {
  requestId: string;
  vendors: MatchVendor[];
}) {
  const router = useRouter();
  const recommended = vendors.filter((v) => v.recommended);
  const others = vendors.filter((v) => !v.recommended);

  const [picked, setPicked] = useState<string[]>(recommended.map((v) => v.id));
  const [showOthers, setShowOthers] = useState(false);
  const [search, setSearch] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const visibleOthers = others.filter((v) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      v.company.toLowerCase().includes(q) ||
      v.email.toLowerCase().includes(q) ||
      v.categories.some((c) => c.toLowerCase().includes(q))
    );
  });

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
      setResult({ ok: Boolean(data?.ok), message: data?.message ?? "Something went wrong." });
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
        There are no approved merchants yet. Approve one on the Merchants page
        and they will show up here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-2.5 text-[13px] font-bold uppercase tracking-[0.08em] text-ink-500">
          Best matches ({recommended.length})
        </p>
        {recommended.length === 0 ? (
          <p className="rounded-xl border border-bone-200 bg-bone-50 px-4 py-3.5 text-[13.5px] leading-relaxed text-ink-500">
            No approved merchant both supplies these categories and covers this
            location. You can still pick from everyone below.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recommended.map((v) => (
              <li key={v.id}>
                <VendorPick vendor={v} checked={picked.includes(v.id)} onToggle={() => toggle(v.id)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {others.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowOthers((o) => !o)}
            aria-expanded={showOthers}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-bone-200 bg-bone-50 px-4 py-3 text-left transition-colors hover:bg-bone-100"
          >
            <span className="text-[14px] font-bold text-ink-800">
              Add other merchants ({others.length})
            </span>
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className={`h-4 w-4 shrink-0 text-ink-400 transition-transform ${showOthers ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            >
              <path d="M6 9.5 12 15l6-5.5" />
            </svg>
          </button>

          {showOthers && (
            <div className="mt-3 flex flex-col gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by company, email or category"
                aria-label="Search other merchants"
                className="min-h-[44px] w-full rounded-xl border-[1.5px] border-bone-200 bg-white px-3.5 text-[14px] outline-none focus:border-forest-500"
              />
              <ul className="flex max-h-[420px] flex-col gap-2 overflow-y-auto">
                {visibleOthers.map((v) => (
                  <li key={v.id}>
                    <VendorPick vendor={v} checked={picked.includes(v.id)} onToggle={() => toggle(v.id)} />
                  </li>
                ))}
                {visibleOthers.length === 0 && (
                  <li className="px-1 py-2 text-[13.5px] text-ink-400">No match.</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

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
