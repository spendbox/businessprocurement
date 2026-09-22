"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  CURRENCIES,
  computeTotals,
  formatMoney,
  type InvoiceItem,
} from "@/lib/invoices";

/* ------------------------------------------------------------------ */
/* Raising an invoice                                                  */
/* ------------------------------------------------------------------ */

type Line = { description: string; quantity: string; unitPrice: string };

export type InvoiceFor = {
  id: string;
  company: string;
  contactName: string;
  email: string;
  address?: string | null;
  reference?: string;
  /** Suggested first line — usually what the buyer asked for. */
  suggestion?: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const inDays = (days: number) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const blankLine = (): Line => ({ description: "", quantity: "1", unitPrice: "" });

const field =
  "min-h-[44px] w-full rounded-xl border-[1.5px] border-bone-200 bg-white px-3.5 text-[14.5px] text-ink-800 outline-none transition-colors focus:border-forest-500";

const label = "text-[12px] font-bold uppercase tracking-[0.07em] text-ink-400";

/**
 * The invoice form.
 *
 * Lines, a rate, a delivery charge, a due date. The total is worked out as
 * you type and shown large, because that is the number both sides will
 * argue about — nobody should have to submit the form to see it.
 */
export function InvoiceBuilder({ billTo }: { billTo?: InvoiceFor }) {
  const router = useRouter();

  const [company, setCompany] = useState(billTo?.company ?? "");
  const [name, setName] = useState(billTo?.contactName ?? "");
  const [email, setEmail] = useState(billTo?.email ?? "");
  const [address, setAddress] = useState(billTo?.address ?? "");
  const [currency, setCurrency] = useState<string>("NGN");
  const [lines, setLines] = useState<Line[]>([
    billTo?.suggestion
      ? { description: billTo.suggestion.slice(0, 160), quantity: "1", unitPrice: "" }
      : blankLine(),
  ]);
  const [taxRate, setTaxRate] = useState("7.5");
  const [delivery, setDelivery] = useState("0");
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState(inDays(14));
  const [notes, setNotes] = useState("");

  const [busy, setBusy] = useState<"save" | "send" | null>(null);
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
    id?: string;
    reference?: string;
  } | null>(null);

  const items: InvoiceItem[] = useMemo(
    () =>
      lines.map((l) => ({
        description: l.description.trim(),
        quantity: Number(l.quantity) || 0,
        unitPrice: Number(l.unitPrice) || 0,
      })),
    [lines],
  );

  const totals = useMemo(
    () => computeTotals(items, Number(taxRate) || 0, Number(delivery) || 0),
    [items, taxRate, delivery],
  );

  const ready =
    company.trim().length > 0 &&
    /.+@.+\..+/.test(email) &&
    items.some((i) => i.description && i.quantity > 0);

  const setLine = (index: number, patch: Partial<Line>) =>
    setLines((all) => all.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const submit = async (send: boolean) => {
    setBusy(send ? "send" : "save");
    setResult(null);
    try {
      const response = await fetch("/api/admin/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: billTo?.id ?? "",
          billToCompany: company.trim(),
          billToName: name.trim(),
          billToEmail: email.trim(),
          billToAddress: (address ?? "").trim(),
          currency,
          items: items.filter((i) => i.description),
          taxRate: Number(taxRate) || 0,
          delivery: Number(delivery) || 0,
          issueDate,
          dueDate,
          notes: notes.trim(),
          send,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        setResult({
          ok: false,
          message: data?.message ?? "The invoice could not be raised.",
        });
        return;
      }
      setResult({
        ok: true,
        message: data.message as string,
        id: data.id as string,
        reference: data.reference as string,
      });
      router.refresh();
    } catch {
      setResult({ ok: false, message: "Could not reach the server." });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Who it is for */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={label}>Bill to</span>
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Business name"
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Contact</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Who signs it off"
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Email it to</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputMode="email"
            placeholder="accounts@business.com"
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Address (optional)</span>
          <input
            value={address ?? ""}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Where they are"
            className={field}
          />
        </label>
      </div>

      {/* The lines */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className={label}>What they are paying for</span>
          <label className="flex items-center gap-2">
            <span className="text-[12.5px] font-semibold text-ink-400">Currency</span>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              aria-label="Currency"
              className="min-h-[38px] rounded-lg border-[1.5px] border-bone-200 bg-white px-2.5 text-[13.5px] font-semibold text-ink-800 outline-none focus:border-forest-500"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <ul className="flex flex-col gap-2">
          {lines.map((line, i) => (
            <li
              key={i}
              className="grid gap-2 rounded-xl border border-bone-200 bg-bone-50 p-2.5 sm:grid-cols-[1fr_84px_128px_auto] sm:items-center"
            >
              <input
                value={line.description}
                onChange={(e) => setLine(i, { description: e.target.value })}
                placeholder="50 ergonomic office chairs, delivered"
                aria-label={`Line ${i + 1} description`}
                className={field}
              />
              <input
                value={line.quantity}
                onChange={(e) => setLine(i, { quantity: e.target.value })}
                inputMode="decimal"
                placeholder="Qty"
                aria-label={`Line ${i + 1} quantity`}
                className={`${field} text-right tabular-nums`}
              />
              <input
                value={line.unitPrice}
                onChange={(e) => setLine(i, { unitPrice: e.target.value })}
                inputMode="decimal"
                placeholder="Unit price"
                aria-label={`Line ${i + 1} unit price`}
                className={`${field} text-right tabular-nums`}
              />
              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <span className="text-[13.5px] font-bold tabular-nums text-ink-700 sm:min-w-[96px] sm:text-right">
                  {formatMoney(items[i]?.quantity * items[i]?.unitPrice || 0, currency)}
                </span>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setLines((all) => all.filter((_, n) => n !== i))}
                    aria-label={`Remove line ${i + 1}`}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-300 transition-colors hover:bg-bone-200 hover:text-clay-400"
                  >
                    ×
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => setLines((all) => [...all, blankLine()])}
          className="self-start rounded-full border-[1.5px] border-dashed border-bone-300 px-3.5 py-2 text-[13.5px] font-bold text-ink-500 transition-colors hover:border-forest-500 hover:text-ink-900"
        >
          + Add a line
        </button>
      </div>

      {/* Terms */}
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1.5">
          <span className={label}>VAT %</span>
          <input
            value={taxRate}
            onChange={(e) => setTaxRate(e.target.value)}
            inputMode="decimal"
            className={`${field} tabular-nums`}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Delivery</span>
          <input
            value={delivery}
            onChange={(e) => setDelivery(e.target.value)}
            inputMode="decimal"
            className={`${field} tabular-nums`}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Issued</span>
          <input
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Due</span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={field}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={label}>Notes on the invoice (optional)</span>
        <textarea
          value={notes}
          rows={3}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Bank details, payment terms, anything the buyer needs to pay it."
          className="w-full rounded-xl border-[1.5px] border-bone-200 bg-white px-3.5 py-3 text-[14.5px] leading-relaxed outline-none transition-colors focus:border-forest-500"
        />
      </label>

      {/* The number that matters */}
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-bone-200 bg-bone-50 px-4 py-3.5">
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
          <div className="flex gap-1.5">
            <dt className="font-semibold text-ink-300">Subtotal</dt>
            <dd className="tabular-nums text-ink-700">
              {formatMoney(totals.subtotal, currency)}
            </dd>
          </div>
          {Number(taxRate) > 0 && (
            <div className="flex gap-1.5">
              <dt className="font-semibold text-ink-300">VAT</dt>
              <dd className="tabular-nums text-ink-700">
                {formatMoney(totals.taxAmount, currency)}
              </dd>
            </div>
          )}
          {Number(delivery) > 0 && (
            <div className="flex gap-1.5">
              <dt className="font-semibold text-ink-300">Delivery</dt>
              <dd className="tabular-nums text-ink-700">
                {formatMoney(Number(delivery), currency)}
              </dd>
            </div>
          )}
        </dl>
        <p className="text-right">
          <span className="block text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">
            Total due
          </span>
          <span className="block font-display text-[26px] font-bold tabular-nums leading-tight text-ink-900">
            {formatMoney(totals.total, currency)}
          </span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => submit(true)}
          disabled={!ready || busy !== null}
          className="inline-flex min-h-[46px] items-center rounded-full bg-forest-500 px-5 text-[14.5px] font-bold text-white transition-colors hover:bg-forest-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "send" ? "Sending…" : "Create and email it"}
        </button>
        <button
          type="button"
          onClick={() => submit(false)}
          disabled={!ready || busy !== null}
          className="inline-flex min-h-[46px] items-center rounded-full border-[1.5px] border-ink-900 px-4 text-[14.5px] font-bold text-ink-900 transition-colors hover:bg-ink-900 hover:text-bone-50 disabled:opacity-50"
        >
          {busy === "save" ? "Saving…" : "Save without sending"}
        </button>
        {!ready && (
          <span className="text-[13px] text-ink-400">
            A business name, an email and one priced line are all it needs.
          </span>
        )}
      </div>

      {result && (
        <div
          role="status"
          className={`rounded-xl border-[1.5px] px-4 py-3.5 ${
            result.ok
              ? "border-forest-200 bg-forest-50"
              : "border-clay-400/40 bg-clay-400/10"
          }`}
        >
          <p
            className={`text-[14px] font-semibold ${
              result.ok ? "text-forest-700" : "text-clay-400"
            }`}
          >
            {result.message}
          </p>
          {result.ok && result.id && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              <a
                href={`/api/admin/invoice/${result.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[38px] items-center rounded-full border-[1.5px] border-forest-200 bg-white px-3.5 text-[13px] font-bold text-forest-700 transition-colors hover:border-forest-500"
              >
                Open and print
              </a>
              <a
                href={`/api/admin/invoice/${result.id}?download`}
                className="inline-flex min-h-[38px] items-center rounded-full border-[1.5px] border-forest-200 bg-white px-3.5 text-[13px] font-bold text-forest-700 transition-colors hover:border-forest-500"
              >
                Download
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Living with an invoice once it exists                               */
/* ------------------------------------------------------------------ */

export function InvoiceActions({
  id,
  email,
  sent,
}: {
  id: string;
  email: string;
  sent: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const send = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/invoice", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await response.json().catch(() => null);
      setMessage({
        ok: Boolean(data?.ok),
        text: data?.message ?? "Something went wrong.",
      });
      if (data?.ok) router.refresh();
    } catch {
      setMessage({ ok: false, text: "Could not reach the server." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={send}
          disabled={busy}
          title={`Email it to ${email}`}
          className="inline-flex min-h-[38px] items-center rounded-full bg-ink-900 px-3.5 text-[13px] font-bold text-bone-50 transition-colors hover:bg-ink-800 disabled:opacity-50"
        >
          {busy ? "Sending…" : sent ? "Send again" : "Email it"}
        </button>
        <a
          href={`/api/admin/invoice/${id}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-[38px] items-center rounded-full border-[1.5px] border-bone-300 px-3.5 text-[13px] font-bold text-ink-700 transition-colors hover:border-ink-900"
        >
          Open
        </a>
        <a
          href={`/api/admin/invoice/${id}?download`}
          className="inline-flex min-h-[38px] items-center rounded-full border-[1.5px] border-bone-300 px-3.5 text-[13px] font-bold text-ink-700 transition-colors hover:border-ink-900"
        >
          Download
        </a>
      </div>
      {message && (
        <span
          role="status"
          className={`text-[12.5px] font-semibold ${
            message.ok ? "text-forest-600" : "text-clay-400"
          }`}
        >
          {message.text}
        </span>
      )}
    </div>
  );
}
