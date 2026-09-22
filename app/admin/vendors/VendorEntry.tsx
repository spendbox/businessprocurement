"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  BUSINESS_AGE,
  CATEGORY_OPTIONS,
  FULFILMENT_SPEEDS,
  PAYMENT_TERMS,
} from "@/lib/catalog";
import { COVERAGE_AREAS } from "@/lib/geo";
import { VENDOR_STATUSES } from "@/lib/admin-data";

/**
 * A merchant typed in by hand.
 *
 * The public application asks a supplier fifteen questions because nobody is
 * sitting with them. Here someone is — usually on the phone — so this asks
 * for what matters and lets the rest wait: a merchant who cannot be matched
 * to a request is the only kind that is no use, and matching needs the
 * categories, the delivery areas and a way to reach them.
 */

export type TeamOption = { id: string; name: string };

const field =
  "min-h-[46px] w-full rounded-xl border-[1.5px] border-bone-200 bg-white px-3.5 text-[14.5px] text-ink-800 outline-none transition-colors focus:border-forest-500";

const label = "text-[12px] font-bold uppercase tracking-[0.07em] text-ink-400";

function Chips({
  options,
  picked,
  onToggle,
}: {
  options: readonly string[];
  picked: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const on = picked.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            aria-pressed={on}
            className={`rounded-full border-[1.5px] px-3 py-2 text-[13px] font-semibold transition-colors ${
              on
                ? "border-forest-500 bg-forest-50 text-forest-700"
                : "border-bone-200 bg-white text-ink-500 hover:border-bone-300 hover:text-ink-800"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

export function VendorEntry({ team }: { team: TeamOption[] }) {
  const router = useRouter();

  const [company, setCompany] = useState("");
  const [contactName, setContactName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [supplyDescription, setSupplyDescription] = useState("");
  const [yearsTrading, setYearsTrading] = useState<string>(BUSINESS_AGE[1] ?? BUSINESS_AGE[0]);
  const [fulfilmentSpeed, setFulfilmentSpeed] = useState<string>(FULFILMENT_SPEEDS[1] ?? FULFILMENT_SPEEDS[0]);
  const [paymentTerms, setPaymentTerms] = useState<string>(PAYMENT_TERMS[0]);
  const [ownLogistics, setOwnLogistics] = useState(false);
  const [rcNumber, setRcNumber] = useState("");
  const [website, setWebsite] = useState("");
  const [moq, setMoq] = useState("");
  const [monthlyCapacity, setMonthlyCapacity] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [status, setStatus] = useState("approved");
  const [assignedTo, setAssignedTo] = useState("");
  const [sendWelcome, setSendWelcome] = useState(false);
  const [more, setMore] = useState(false);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const ready =
    company.trim().length > 1 &&
    contactName.trim().length > 1 &&
    /.+@.+\..+/.test(email) &&
    phone.trim().length > 6 &&
    categories.length > 0 &&
    regions.length > 0 &&
    supplyDescription.trim().length > 4;

  const save = async () => {
    setBusy(true);
    setResult(null);
    setErrors({});
    try {
      const response = await fetch("/api/admin/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: company.trim(),
          contactName: contactName.trim(),
          role: role.trim(),
          email: email.trim(),
          phone: phone.trim(),
          categories,
          regions,
          supplyDescription: supplyDescription.trim(),
          yearsTrading,
          fulfilmentSpeed,
          paymentTerms,
          ownLogistics,
          rcNumber: rcNumber.trim(),
          website: website.trim(),
          moq: moq.trim(),
          monthlyCapacity: monthlyCapacity.trim(),
          internalNotes: internalNotes.trim(),
          status,
          assignedTo,
          sendWelcome,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        if (data?.errors) setErrors(data.errors as Record<string, string>);
        setResult({
          ok: false,
          message: data?.message ?? "That merchant could not be saved.",
        });
        return;
      }
      setResult({ ok: true, message: data.message as string });
      router.refresh();
      router.push("/admin/vendors");
    } catch {
      setResult({ ok: false, message: "Could not reach the server." });
    } finally {
      setBusy(false);
    }
  };

  const problem = (key: string) =>
    errors[key] ? (
      <span className="text-[12.5px] font-semibold text-clay-400">{errors[key]}</span>
    ) : null;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-2xl border border-bone-200 bg-white p-5">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-ink-500">
          Who they are
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={label}>Company *</span>
            <input value={company} onChange={(e) => setCompany(e.target.value)} className={field} />
            {problem("company")}
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={label}>Contact name *</span>
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className={field}
            />
            {problem("contactName")}
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={label}>Email *</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              inputMode="email"
              className={field}
            />
            {problem("email")}
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={label}>Phone *</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder="+234…"
              className={field}
            />
            {problem("phone")}
          </label>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-bone-200 bg-white p-5">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-ink-500">
          What they supply
        </h2>

        <div className="flex flex-col gap-2">
          <span className={label}>Categories * ({categories.length} picked)</span>
          <Chips
            options={CATEGORY_OPTIONS}
            picked={categories}
            onToggle={(v) => setCategories((c) => toggle(c, v))}
          />
          {problem("categories")}
        </div>

        <label className="mt-1 flex flex-col gap-1.5">
          <span className={label}>In their own words *</span>
          <textarea
            value={supplyDescription}
            rows={3}
            onChange={(e) => setSupplyDescription(e.target.value)}
            placeholder="Office furniture — chairs, desks and partitions. Imports direct and holds stock in Lagos."
            className="w-full rounded-xl border-[1.5px] border-bone-200 bg-white px-3.5 py-3 text-[14.5px] leading-relaxed outline-none transition-colors focus:border-forest-500"
          />
          {problem("supplyDescription")}
        </label>

        <div className="mt-1 flex flex-col gap-2">
          <span className={label}>Delivers to * ({regions.length} picked)</span>
          <Chips
            options={COVERAGE_AREAS}
            picked={regions}
            onToggle={(v) => setRegions((r) => toggle(r, v))}
          />
          {problem("regions")}
        </div>

        <div className="mt-1 grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className={label}>Years trading</span>
            <select
              value={yearsTrading}
              onChange={(e) => setYearsTrading(e.target.value)}
              className={field}
            >
              {BUSINESS_AGE.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={label}>Fulfils in</span>
            <select
              value={fulfilmentSpeed}
              onChange={(e) => setFulfilmentSpeed(e.target.value)}
              className={field}
            >
              {FULFILMENT_SPEEDS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={label}>Payment terms</span>
            <select
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className={field}
            >
              {PAYMENT_TERMS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-1 flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={ownLogistics}
            onChange={(e) => setOwnLogistics(e.target.checked)}
            className="h-5 w-5 accent-forest-500"
          />
          <span className="text-[14px] font-semibold text-ink-700">
            They deliver themselves
          </span>
        </label>
      </section>

      {/* Everything that can wait until you have it. */}
      <section className="rounded-2xl border border-bone-200 bg-white">
        <button
          type="button"
          onClick={() => setMore((m) => !m)}
          aria-expanded={more}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
        >
          <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-ink-500">
            The rest — optional
          </span>
          <span className="text-[13px] font-semibold text-ink-400">
            {more ? "Hide" : "RC number, website, capacity, notes"}
          </span>
        </button>
        {more && (
          <div className="grid gap-3 border-t border-bone-200 p-5 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className={label}>Their role</span>
              <input value={role} onChange={(e) => setRole(e.target.value)} className={field} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={label}>RC number</span>
              <input
                value={rcNumber}
                onChange={(e) => setRcNumber(e.target.value)}
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={label}>Website</span>
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={label}>Minimum order</span>
              <input value={moq} onChange={(e) => setMoq(e.target.value)} className={field} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={label}>Monthly capacity</span>
              <input
                value={monthlyCapacity}
                onChange={(e) => setMonthlyCapacity(e.target.value)}
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className={label}>Internal notes — never shown to them</span>
              <textarea
                value={internalNotes}
                rows={3}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Where they came from, who vouched for them, what to watch."
                className="w-full rounded-xl border-[1.5px] border-bone-200 bg-white px-3.5 py-3 text-[14.5px] leading-relaxed outline-none transition-colors focus:border-forest-500"
              />
            </label>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-bone-200 bg-white p-5">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-ink-500">
          How they start
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={label}>Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={field}
            >
              {VENDOR_STATUSES.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <span className="text-[12.5px] leading-snug text-ink-400">
              Only approved merchants are offered when you send a request out.
            </span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={label}>Who looks after them</span>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className={field}
            >
              <option value="">Nobody yet</option>
              {team.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
            {team.length === 0 && (
              <span className="text-[12.5px] leading-snug text-ink-400">
                Add people on the Team page and they will show up here.
              </span>
            )}
          </label>
        </div>

        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={sendWelcome}
            disabled={status !== "approved"}
            onChange={(e) => setSendWelcome(e.target.checked)}
            className="mt-0.5 h-5 w-5 accent-forest-500 disabled:opacity-40"
          />
          <span className="text-[14px] leading-snug text-ink-700">
            <span className="font-semibold">Email them that they are set up.</span>{" "}
            <span className="text-ink-400">
              {status === "approved"
                ? "They get their reference and what we hold for them."
                : "Only for merchants you are approving now."}
            </span>
          </span>
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!ready || busy}
          className="inline-flex min-h-[48px] items-center rounded-full bg-forest-500 px-5 text-[15px] font-bold text-white transition-colors hover:bg-forest-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Saving…" : "Add this merchant"}
        </button>
        {!ready && (
          <span className="text-[13px] text-ink-400">
            Everything marked * is needed — the rest can come later.
          </span>
        )}
      </div>

      {result && (
        <p
          role="status"
          className={`rounded-xl border-[1.5px] px-4 py-3.5 text-[14px] font-semibold ${
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
