"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { discountLabel, parseDiscount } from "@/lib/discount";
import { fieldsIn, fillFields, renderDoc } from "@/lib/doc-render";

const field =
  "min-h-[46px] w-full rounded-xl border-[1.5px] border-bone-200 bg-white px-3.5 text-[14.5px] text-ink-800 outline-none transition-colors focus:border-forest-500";
const label = "text-[12px] font-bold uppercase tracking-[0.07em] text-ink-400";

const prettyDate = (iso: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : iso;

const pct = (value: string) => {
  const n = Number(value);
  return value.trim() === "" || !Number.isFinite(n) ? "" : String(n);
};

/**
 * Drafting one merchant's agreement.
 *
 * The discount, the length and the start date sit at the top because they
 * are what gets negotiated; the words below come from the template and can
 * be changed for this merchant alone. The preview is exactly what they will
 * read — only the reference is given out when it is sent.
 */
export function AgreementComposer({
  vendorId,
  vendorEmail,
  template,
  fields,
  initialDiscount,
  termMonths,
}: {
  vendorId: string;
  vendorEmail: string;
  template: { title: string; body: string };
  /** Every field already filled for this merchant, bar the ones set here. */
  fields: Record<string, string>;
  initialDiscount: { min: number | null; max: number | null };
  termMonths: number;
}) {
  const router = useRouter();
  const [min, setMin] = useState(initialDiscount.min?.toString() ?? "");
  const [max, setMax] = useState(initialDiscount.max?.toString() ?? "");
  const [term, setTerm] = useState(String(termMonths));
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState(template.title);
  const [body, setBody] = useState(template.body);
  const [editing, setEditing] = useState(false);
  const [saveDiscount, setSaveDiscount] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const discount = parseDiscount(min, max);
  const discountProblem = !discount.ok
    ? discount.message
    : discount.min === null && discount.max === null
      ? "Agree a discount range first."
      : null;

  const filled = useMemo(
    () => ({
      ...fields,
      discount_min: pct(min) || pct(max) || "an agreed",
      discount_max: pct(max) || pct(min) || "an agreed",
      term_months: term,
      start_date: prettyDate(start),
    }),
    [fields, min, max, term, start],
  );

  const known = new Set([...Object.keys(fields), "discount_min", "discount_max", "term_months", "start_date"]);
  const unknown = [...new Set([...fieldsIn(title), ...fieldsIn(body)])].filter((f) => !known.has(f));

  const preview = useMemo(() => renderDoc(fillFields(body, filled), { size: "page" }), [body, filled]);

  const send = async () => {
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId,
          title,
          body,
          discountMin: min,
          discountMax: max,
          termMonths: Number(term),
          startDate: start,
          saveDiscount,
        }),
      });
      const data = await response.json().catch(() => null);
      setResult({ ok: Boolean(data?.ok), message: data?.message ?? "It could not be sent." });
      if (data?.ok) router.refresh();
    } catch {
      setResult({ ok: false, message: "Could not reach the server." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1.5">
          <span className={label}>Discount from</span>
          <span className="flex items-center gap-2">
            <input value={min} onChange={(e) => setMin(e.target.value)} inputMode="decimal" placeholder="5" className={`${field} tabular-nums`} />
            <span className="text-[14px] font-bold text-ink-400">%</span>
          </span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Discount up to</span>
          <span className="flex items-center gap-2">
            <input value={max} onChange={(e) => setMax(e.target.value)} inputMode="decimal" placeholder="12" className={`${field} tabular-nums`} />
            <span className="text-[14px] font-bold text-ink-400">%</span>
          </span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Runs for</span>
          <span className="flex items-center gap-2">
            <input value={term} onChange={(e) => setTerm(e.target.value)} inputMode="numeric" className={`${field} tabular-nums`} />
            <span className="text-[13px] font-semibold text-ink-400">months</span>
          </span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Effective from</span>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={field} />
        </label>
      </div>

      <p className={`text-[13.5px] ${discountProblem ? "font-semibold text-clay-400" : "text-ink-400"}`}>
        {discountProblem ??
          `They agree to ${discountLabel(discount.ok ? discount.min : null, discount.ok ? discount.max : null)} off their standard price for Spendbox businesses.`}
      </p>

      <div className="rounded-2xl border border-bone-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-bone-200 px-5 py-3.5">
          <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-ink-500">
            {editing ? "Changing the words for this merchant" : "What they will read"}
          </span>
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className="rounded-full border-[1.5px] border-bone-300 px-3.5 py-1.5 text-[13px] font-bold text-ink-700 hover:border-ink-900"
          >
            {editing ? "Back to the preview" : "Change the words"}
          </button>
        </div>
        {editing ? (
          <div className="flex flex-col gap-3 p-5">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} aria-label="Title" />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-[480px] w-full rounded-xl border-[1.5px] border-bone-200 bg-white px-4 py-3 font-mono text-[13.5px] leading-relaxed outline-none focus:border-forest-500"
            />
            <p className="text-[12.5px] text-ink-400">
              Changes here are for this merchant only. To change what every merchant gets,
              edit the agreement template.
            </p>
          </div>
        ) : (
          <div
            className="max-h-[620px] overflow-y-auto p-6"
            /* renderDoc escapes the text before formatting it. */
            dangerouslySetInnerHTML={{ __html: preview }}
          />
        )}
      </div>

      {unknown.length > 0 && (
        <p role="alert" className="rounded-xl border-[1.5px] border-amber-400/50 bg-amber-400/10 px-4 py-3 text-[13.5px] font-semibold text-amber-500">
          Not a field the agreement knows: {unknown.map((f) => `{{${f}}}`).join(", ")}.
        </p>
      )}

      <label className="flex items-center gap-2.5">
        <input type="checkbox" checked={saveDiscount} onChange={(e) => setSaveDiscount(e.target.checked)} className="h-5 w-5 accent-forest-500" />
        <span className="text-[14px] text-ink-700">Also record this discount range on the merchant</span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={send}
          disabled={busy || Boolean(discountProblem) || unknown.length > 0 || !Number(term)}
          className="inline-flex min-h-[48px] items-center rounded-full bg-forest-500 px-5 text-[15px] font-bold text-white transition-colors hover:bg-forest-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Sending…" : `Email it to ${vendorEmail} to sign`}
        </button>
        {result && (
          <span role="status" className={`text-[13.5px] font-semibold ${result.ok ? "text-forest-600" : "text-clay-400"}`}>
            {result.message}
          </span>
        )}
      </div>
    </div>
  );
}

/** Resend, void, open and download — for one agreement already sent. */
export function AgreementActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const act = async (method: "PUT" | "PATCH") => {
    if (method === "PATCH" && !window.confirm("Void this agreement? Its signing link will stop working.")) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/agreements", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await response.json().catch(() => null);
      setMessage({ ok: Boolean(data?.ok), text: data?.message ?? "Something went wrong." });
      if (data?.ok) router.refresh();
    } catch {
      setMessage({ ok: false, text: "Could not reach the server." });
    } finally {
      setBusy(false);
    }
  };

  const button =
    "inline-flex min-h-[38px] items-center rounded-full border-[1.5px] border-bone-300 px-3.5 text-[13px] font-bold text-ink-700 transition-colors hover:border-ink-900 disabled:opacity-50";

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex flex-wrap gap-2">
        <a href={`/api/admin/agreements/${id}`} target="_blank" rel="noreferrer" className={button}>
          Open
        </a>
        <a href={`/api/admin/agreements/${id}?download`} className={button}>
          Download
        </a>
        {status === "sent" && (
          <>
            <button type="button" disabled={busy} onClick={() => act("PUT")} className={button}>
              Send the link again
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => act("PATCH")}
              className="inline-flex min-h-[38px] items-center rounded-full px-3 text-[13px] font-bold text-ink-400 hover:text-clay-400 disabled:opacity-50"
            >
              Void
            </button>
          </>
        )}
      </div>
      {message && (
        <span role="status" className={`text-[12.5px] font-semibold ${message.ok ? "text-forest-600" : "text-clay-400"}`}>
          {message.text}
        </span>
      )}
    </div>
  );
}
