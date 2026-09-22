"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { discountLabel, parseDiscount } from "@/lib/discount";

const small =
  "min-h-[38px] rounded-lg border-[1.5px] border-bone-200 bg-white px-2.5 text-[13px] font-semibold text-ink-800 outline-none transition-colors focus:border-forest-500 disabled:opacity-60";

async function call(url: string, method: string, body: unknown) {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
    return { ok: Boolean(response.ok && data?.ok), message: data?.message ?? "Could not save that." };
  } catch {
    return { ok: false, message: "Could not reach the server." };
  }
}

/** The agreed discount range, read at a glance and changed in place. */
export function DiscountEditor({
  vendorId,
  min,
  max,
}: {
  vendorId: string;
  min: number | null;
  max: number | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [lo, setLo] = useState(min?.toString() ?? "");
  const [hi, setHi] = useState(max?.toString() ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseDiscount(lo, hi);

  const save = async () => {
    setBusy(true);
    setError(null);
    const result = await call("/api/admin/vendors", "PATCH", { id: vendorId, discountMin: lo, discountMax: hi });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setEditing(false);
    router.refresh();
  };

  if (!editing) {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-bold uppercase tracking-[0.07em] text-ink-300">Discount</span>
        <span className={`text-[13.5px] font-bold ${min === null && max === null ? "text-ink-300" : "text-forest-600"}`}>
          {discountLabel(min, max)}
        </span>
        <button type="button" onClick={() => setEditing(true)} className="text-[12.5px] font-bold text-ink-400 underline underline-offset-4 hover:text-ink-900">
          change
        </button>
      </span>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-[12px] font-bold uppercase tracking-[0.07em] text-ink-300">Discount</span>
      <input value={lo} onChange={(e) => setLo(e.target.value)} inputMode="decimal" placeholder="from" aria-label="Lowest discount %" className={`${small} w-[72px] tabular-nums`} />
      <span className="text-[13px] text-ink-400">–</span>
      <input value={hi} onChange={(e) => setHi(e.target.value)} inputMode="decimal" placeholder="up to" aria-label="Highest discount %" className={`${small} w-[72px] tabular-nums`} />
      <span className="text-[13px] font-bold text-ink-400">%</span>
      <button type="button" onClick={save} disabled={busy || !parsed.ok} className="inline-flex min-h-[36px] items-center rounded-full bg-ink-900 px-3 text-[12.5px] font-bold text-bone-50 disabled:opacity-50">
        {busy ? "Saving…" : "Save"}
      </button>
      <button type="button" onClick={() => setEditing(false)} className="text-[12.5px] font-bold text-ink-400 hover:text-ink-900">
        cancel
      </button>
      {(error || !parsed.ok) && (
        <span role="alert" className="text-[12px] font-semibold text-clay-400">
          {error ?? (!parsed.ok ? parsed.message : "")}
        </span>
      )}
    </span>
  );
}

/** Which marketer works this merchant. Saves as it changes. */
export function MarketerPicker({
  vendorId,
  value,
  marketers,
}: {
  vendorId: string;
  value: string;
  marketers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(value);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (marketers.length === 0) return null;

  const change = async (next: string) => {
    const previous = current;
    setCurrent(next);
    setBusy(true);
    setMessage(null);
    const result = await call("/api/admin/marketers/assign", "POST", {
      vendorId,
      marketerId: next || null,
      notify: false,
    });
    setBusy(false);
    if (!result.ok) setCurrent(previous);
    setMessage({ ok: result.ok, text: result.ok ? "Saved" : result.message });
    if (result.ok) router.refresh();
  };

  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-[12px] font-bold uppercase tracking-[0.07em] text-ink-300">Marketer</span>
      <select value={current} disabled={busy} onChange={(e) => change(e.target.value)} aria-label="Marketer for this merchant" className={small}>
        <option value="">Nobody</option>
        {marketers.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      {message && (
        <span role="status" className={`text-[12px] font-semibold ${message.ok ? "text-forest-600" : "text-clay-400"}`}>
          {message.text}
        </span>
      )}
    </span>
  );
}

/** Which marketer brought a business in — what their targets count. */
export function AttributeMarketer({
  requestId,
  value,
  marketers,
}: {
  requestId: string;
  value: string;
  marketers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(value);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (marketers.length === 0) {
    return <p className="text-[13.5px] text-ink-400">No marketers on the team yet.</p>;
  }

  const change = async (next: string) => {
    const previous = current;
    setCurrent(next);
    setBusy(true);
    setMessage(null);
    const result = await call("/api/admin/requests/marketer", "POST", { requestId, marketerId: next || null });
    setBusy(false);
    if (!result.ok) setCurrent(previous);
    setMessage({ ok: result.ok, text: result.message });
    if (result.ok) router.refresh();
  };

  return (
    <div className="flex flex-col gap-2">
      <select value={current} disabled={busy} onChange={(e) => change(e.target.value)} aria-label="Brought in by" className={`${small} min-h-[44px] w-full text-[14px]`}>
        <option value="">Nobody — came in on its own</option>
        {marketers.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <p className="text-[12.5px] leading-relaxed text-ink-400">
        This is what counts the business, and any paid invoice on it, towards their targets.
      </p>
      {message && (
        <span role="status" className={`text-[12.5px] font-semibold ${message.ok ? "text-forest-600" : "text-clay-400"}`}>
          {message.text}
        </span>
      )}
    </div>
  );
}
