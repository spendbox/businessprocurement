"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { discountLabel } from "@/lib/discount";
import { formatMoney } from "@/lib/invoices";

/* ------------------------------------------------------------------ */
/* Shapes handed down from the server page                             */
/* ------------------------------------------------------------------ */

export type BoardVendor = {
  id: string;
  company: string;
  categories: string[];
  status: string;
  discount_min: number | null;
  discount_max: number | null;
  marketer_id: string | null;
};

export type BoardMarketer = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  active: boolean;
  started_on: string | null;
  created_at: string;
  lastEmailedAt: string | null;
  progress: {
    start: string;
    businessDeadline: string;
    salesDeadline: string;
    businesses: number;
    sales: number;
    businessesAllTime: number;
    salesAllTime: number;
  };
};

export type BoardTargets = {
  targetBusinesses: number;
  businessWindowDays: number;
  targetSales: number;
  salesWindowDays: number;
};

type Starter = {
  id: string;
  label: string;
  subject: string;
  message: string;
  include: string[];
};

const field =
  "min-h-[44px] w-full rounded-xl border-[1.5px] border-bone-200 bg-white px-3.5 text-[14.5px] text-ink-800 outline-none transition-colors focus:border-forest-500";
const label = "text-[12px] font-bold uppercase tracking-[0.07em] text-ink-400";
const ghost =
  "inline-flex min-h-[38px] items-center rounded-full border-[1.5px] border-bone-300 px-3.5 text-[13px] font-bold text-ink-700 transition-colors hover:border-ink-900 disabled:opacity-50";

const day = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

const naira = (n: number) => formatMoney(n, "NGN").replace(/\.00$/, "");

async function send(url: string, method: string, body: unknown) {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => null)) as
      | { ok?: boolean; message?: string; errors?: Record<string, string>; html?: string; to?: string; subject?: string }
      | null;
    return { ok: Boolean(response.ok && data?.ok), data };
  } catch {
    return { ok: false, data: { message: "Could not reach the server." } };
  }
}

function Note({ result }: { result: { ok: boolean; message: string } | null }) {
  if (!result) return null;
  return (
    <span role="status" className={`text-[13px] font-semibold ${result.ok ? "text-forest-600" : "text-clay-400"}`}>
      {result.message}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Progress                                                            */
/* ------------------------------------------------------------------ */

/**
 * One bar per target. The colour says whether they are on pace for the
 * deadline, not just how far along they are — 10 of 30 is fine on day 8
 * and a problem on day 25.
 */
function Target({
  title,
  done,
  goal,
  shown,
  start,
  deadline,
}: {
  title: string;
  done: number;
  goal: number;
  shown: string;
  start: string;
  deadline: string;
}) {
  const startMs = new Date(`${start}T00:00:00Z`).getTime();
  const endMs = new Date(`${deadline}T23:59:59Z`).getTime();
  const elapsed = Math.min(1, Math.max(0, (Date.now() - startMs) / (endMs - startMs)));
  const fraction = Math.min(1, done / goal);
  const over = Date.now() > endMs;
  const tone =
    fraction >= 1
      ? "bg-forest-500"
      : fraction + 0.05 >= elapsed
        ? "bg-forest-500"
        : over
          ? "bg-clay-400"
          : "bg-amber-400";
  const verdict =
    fraction >= 1 ? "Hit" : over ? "Missed" : fraction + 0.05 >= elapsed ? "On pace" : "Behind pace";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-semibold text-ink-700">{title}</span>
        <span className="text-[12px] font-bold uppercase tracking-wide text-ink-400">{verdict}</span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-bone-200">
        <span className={`block h-full rounded-full ${tone}`} style={{ width: `${Math.max(2, fraction * 100)}%` }} />
        {!over && fraction < 1 && (
          /* Where they should be by today. */
          <span aria-hidden className="absolute top-0 h-full w-0.5 bg-ink-900/40" style={{ left: `${elapsed * 100}%` }} />
        )}
      </div>
      <span className="text-[12.5px] text-ink-400">
        <span className="font-bold tabular-nums text-ink-800">{shown}</span> by {day(deadline)}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Adding a marketer                                                   */
/* ------------------------------------------------------------------ */

export function AddMarketer() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [startedOn, setStartedOn] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const ready = name.trim().length > 1 && /.+@.+\..+/.test(email);

  const add = async () => {
    setBusy(true);
    const { ok, data } = await send("/api/admin/team", "POST", {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      role: "marketer",
      startedOn,
      notes: notes.trim(),
    });
    const errors = data?.errors ? Object.values(data.errors).join(" ") : "";
    setResult({ ok, message: `${data?.message ?? "Could not add them."}${errors ? ` ${errors}` : ""}` });
    if (ok) {
      setName("");
      setEmail("");
      setPhone("");
      setNotes("");
      router.refresh();
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1.5">
          <span className={label}>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" className={field} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Phone</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+234…" className={field} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Targets start</span>
          <input type="date" value={startedOn} onChange={(e) => setStartedOn(e.target.value)} className={field} />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className={label}>Notes (optional)</span>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Area they cover, who referred them…" className={field} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={add}
          disabled={!ready || busy}
          className="inline-flex min-h-[46px] items-center rounded-full bg-forest-500 px-5 text-[14.5px] font-bold text-white transition-colors hover:bg-forest-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add marketer"}
        </button>
        <Note result={result} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The board: composer + one card per marketer                         */
/* ------------------------------------------------------------------ */

export function MarketersBoard({
  marketers,
  vendors,
  targets,
  starters,
  includeLabels,
  fieldHelp,
}: {
  marketers: BoardMarketer[];
  vendors: BoardVendor[];
  targets: BoardTargets;
  starters: Starter[];
  includeLabels: Record<string, string>;
  fieldHelp: { field: string; means: string }[];
}) {
  const composer = useRef<HTMLDivElement>(null);
  const [recipients, setRecipients] = useState<string[]>(
    marketers.filter((m) => m.active).map((m) => m.id),
  );

  const emailOne = (id: string) => {
    setRecipients([id]);
    composer.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const names = useMemo(() => Object.fromEntries(marketers.map((m) => [m.id, m.name])), [marketers]);

  return (
    <div className="flex flex-col gap-6">
      {marketers.length === 0 ? (
        <p className="rounded-2xl border border-bone-200 bg-white px-5 py-10 text-center text-[14.5px] text-ink-400">
          No marketers yet. Add the first one below.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {marketers.map((m) => (
            <MarketerCard
              key={m.id}
              marketer={m}
              others={marketers.filter((o) => o.id !== m.id)}
              vendors={vendors}
              names={names}
              targets={targets}
              onEmail={() => emailOne(m.id)}
            />
          ))}
        </ul>
      )}

      {marketers.length > 0 && (
        <div ref={composer} className="scroll-mt-24">
          <Composer
            marketers={marketers}
            recipients={recipients}
            setRecipients={setRecipients}
            starters={starters}
            includeLabels={includeLabels}
            fieldHelp={fieldHelp}
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One marketer                                                        */
/* ------------------------------------------------------------------ */

function MarketerCard({
  marketer: m,
  others,
  vendors,
  names,
  targets,
  onEmail,
}: {
  marketer: BoardMarketer;
  others: BoardMarketer[];
  vendors: BoardVendor[];
  names: Record<string, string>;
  targets: BoardTargets;
  onEmail: () => void;
}) {
  const router = useRouter();
  const mine = vendors.filter((v) => v.marketer_id === m.id);

  const [notify, setNotify] = useState(true);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(m.name);
  const [email, setEmail] = useState(m.email);
  const [phone, setPhone] = useState(m.phone ?? "");
  const [startedOn, setStartedOn] = useState((m.started_on ?? m.created_at).slice(0, 10));
  const [notes, setNotes] = useState(m.notes ?? "");

  const [removing, setRemoving] = useState(false);
  const [handTo, setHandTo] = useState("");

  const run = async (url: string, method: string, body: unknown) => {
    setBusy(true);
    setResult(null);
    const { ok, data } = await send(url, method, body);
    setResult({ ok, message: data?.message ?? (ok ? "Done." : "That did not work.") });
    if (ok) router.refresh();
    setBusy(false);
    return ok;
  };

  const assign = (vendorId: string, marketerId: string | null) =>
    run("/api/admin/marketers/assign", "POST", { vendorId, marketerId, notify });

  const available = vendors.filter((v) => v.marketer_id !== m.id);

  return (
    <li className={`rounded-2xl border bg-white p-4 sm:p-5 ${m.active ? "border-bone-200" : "border-bone-300 opacity-80"}`}>
      {/* Who they are */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-[17px] font-bold text-ink-900">{m.name}</span>
            {!m.active && (
              <span className="rounded-full border border-clay-400/40 bg-clay-400/12 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-clay-400">
                switched off
              </span>
            )}
          </p>
          <p className="mt-0.5 text-[13.5px] text-ink-400">
            <a href={`mailto:${m.email}`} className="font-semibold text-forest-500 hover:text-forest-600">{m.email}</a>
            {m.phone && (
              <>
                {" · "}
                <a href={`tel:${m.phone.replace(/\s/g, "")}`} className="hover:text-ink-900">{m.phone}</a>
              </>
            )}
            {" · "}started {day(m.progress.start)}
            {m.lastEmailedAt ? ` · last emailed ${day(m.lastEmailedAt)}` : " · not emailed yet"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onEmail} className="inline-flex min-h-[38px] items-center rounded-full bg-ink-900 px-3.5 text-[13px] font-bold text-bone-50 hover:bg-ink-800">
            Email
          </button>
          <button type="button" onClick={() => setEditing((e) => !e)} aria-expanded={editing} className={ghost}>
            {editing ? "Close" : "Edit"}
          </button>
          <button type="button" onClick={() => setRemoving((r) => !r)} className="inline-flex min-h-[38px] items-center rounded-full px-3 text-[13px] font-bold text-ink-400 hover:text-clay-400">
            Remove
          </button>
        </div>
      </div>

      {/* Targets */}
      <div className="mt-4 grid gap-4 rounded-xl bg-bone-50 p-4 sm:grid-cols-2">
        <Target
          title="Businesses on board"
          done={m.progress.businesses}
          goal={targets.targetBusinesses}
          shown={`${m.progress.businesses} of ${targets.targetBusinesses}`}
          start={m.progress.start}
          deadline={m.progress.businessDeadline}
        />
        <Target
          title="Sales from their businesses"
          done={m.progress.sales}
          goal={targets.targetSales}
          shown={`${naira(m.progress.sales)} of ${naira(targets.targetSales)}`}
          start={m.progress.start}
          deadline={m.progress.salesDeadline}
        />
      </div>

      {/* Their merchants */}
      <div className="mt-4">
        <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.08em] text-ink-400">
          Their merchants ({mine.length})
        </p>
        {mine.length === 0 ? (
          <p className="text-[13.5px] text-ink-400">None yet — assign one below.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-bone-200 rounded-xl border border-bone-200">
            {mine.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold text-ink-900">{v.company}</span>
                  <span className="block text-[12.5px] text-ink-400">
                    discount {discountLabel(v.discount_min, v.discount_max)} · {v.status}
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <select
                    value=""
                    disabled={busy}
                    onChange={(e) => e.target.value && assign(v.id, e.target.value === "__none" ? null : e.target.value)}
                    aria-label={`Move ${v.company}`}
                    className="min-h-[36px] rounded-lg border-[1.5px] border-bone-200 bg-white px-2 text-[12.5px] font-semibold text-ink-700 outline-none focus:border-forest-500"
                  >
                    <option value="">Move to…</option>
                    {others.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                    <option value="__none">Nobody (unassign)</option>
                  </select>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <select
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            aria-label="Merchant to assign"
            className="min-h-[40px] min-w-0 flex-1 rounded-lg border-[1.5px] border-bone-200 bg-white px-2.5 text-[13.5px] text-ink-800 outline-none focus:border-forest-500 sm:max-w-[360px]"
          >
            <option value="">Assign a merchant…</option>
            {available.map((v) => (
              <option key={v.id} value={v.id}>
                {v.company}
                {v.marketer_id ? ` — now with ${names[v.marketer_id] ?? "someone"}` : ""}
                {v.status !== "approved" ? ` (${v.status})` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!pick || busy}
            onClick={async () => {
              if (await assign(pick, m.id)) setPick("");
            }}
            className={ghost}
          >
            Assign
          </button>
          <label className="flex items-center gap-2 text-[13px] text-ink-600">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="h-4 w-4 accent-forest-500" />
            Email them about it
          </label>
        </div>
      </div>

      {/* Editing */}
      {editing && (
        <div className="mt-4 flex flex-col gap-3 border-t border-bone-200 pt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1.5">
              <span className={label}>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={label}>Email</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={label}>Phone</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={field} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={label}>Targets start</span>
              <input type="date" value={startedOn} onChange={(e) => setStartedOn(e.target.value)} className={field} />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className={label}>Notes</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={field} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (
                  await run("/api/admin/team", "PATCH", {
                    id: m.id,
                    name: name.trim(),
                    email: email.trim(),
                    phone: phone.trim(),
                    startedOn,
                    notes: notes.trim(),
                  })
                ) {
                  setEditing(false);
                }
              }}
              className="inline-flex min-h-[40px] items-center rounded-full bg-ink-900 px-4 text-[13.5px] font-bold text-bone-50 hover:bg-ink-800 disabled:opacity-50"
            >
              Save
            </button>
            <button type="button" disabled={busy} onClick={() => run("/api/admin/team", "PATCH", { id: m.id, active: !m.active })} className={ghost}>
              {m.active ? "Switch off" : "Switch back on"}
            </button>
          </div>
        </div>
      )}

      {/* Removing, with a proper hand-over */}
      {removing && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border-[1.5px] border-clay-400/40 bg-clay-400/8 p-4">
          <p className="text-[14px] font-semibold text-ink-800">
            Remove {m.name}? {mine.length > 0 && `They have ${mine.length} merchant${mine.length === 1 ? "" : "s"}.`}
          </p>
          <label className="flex flex-col gap-1.5">
            <span className={label}>Hand their merchants and businesses to</span>
            <select value={handTo} onChange={(e) => setHandTo(e.target.value)} className={`${field} sm:max-w-[360px]`}>
              <option value="">Nobody — leave them unassigned</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => run("/api/admin/team", "DELETE", { id: m.id, reassignTo: handTo })}
              className="inline-flex min-h-[40px] items-center rounded-full bg-clay-400 px-4 text-[13.5px] font-bold text-white disabled:opacity-50"
            >
              {busy ? "Removing…" : "Yes, remove"}
            </button>
            <button type="button" onClick={() => setRemoving(false)} className="inline-flex min-h-[40px] items-center px-3 text-[13.5px] font-bold text-ink-500 hover:text-ink-900">
              Keep them
            </button>
          </div>
          <p className="text-[12.5px] text-ink-500">Nothing about a merchant or a business is deleted either way.</p>
        </div>
      )}

      {result && (
        <p className="mt-3">
          <Note result={result} />
        </p>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Writing to marketers                                                */
/* ------------------------------------------------------------------ */

function Composer({
  marketers,
  recipients,
  setRecipients,
  starters,
  includeLabels,
  fieldHelp,
}: {
  marketers: BoardMarketer[];
  recipients: string[];
  setRecipients: (ids: string[]) => void;
  starters: Starter[];
  includeLabels: Record<string, string>;
  fieldHelp: { field: string; means: string }[];
}) {
  const first = starters[0];
  const [starter, setStarter] = useState(first.id);
  const [subject, setSubject] = useState(first.subject);
  const [message, setMessage] = useState(first.message);
  const [include, setInclude] = useState<string[]>(first.include);
  const [busy, setBusy] = useState<"preview" | "send" | null>(null);
  const [preview, setPreview] = useState<{ to: string; subject: string; html: string } | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const applyStarter = (id: string) => {
    const s = starters.find((x) => x.id === id);
    if (!s) return;
    setStarter(id);
    setSubject(s.subject);
    setMessage(s.message);
    setInclude(s.include);
    setPreview(null);
  };

  const toggle = (id: string) =>
    setRecipients(recipients.includes(id) ? recipients.filter((r) => r !== id) : [...recipients, id]);

  const payload = { memberIds: recipients, subject, message, include };
  const ready = recipients.length > 0 && subject.trim().length > 2 && message.trim().length > 4;

  const doPreview = async () => {
    setBusy("preview");
    setResult(null);
    const { ok, data } = await send("/api/admin/marketers/email", "POST", { ...payload, preview: true });
    if (ok && data?.html) setPreview({ to: data.to ?? "", subject: data.subject ?? "", html: data.html });
    else setResult({ ok: false, message: data?.message ?? "Could not build the preview." });
    setBusy(null);
  };

  const doSend = async () => {
    if (!window.confirm(`Send this to ${recipients.length} marketer${recipients.length === 1 ? "" : "s"}? Each gets their own version.`)) return;
    setBusy("send");
    setResult(null);
    const { ok, data } = await send("/api/admin/marketers/email", "POST", payload);
    setResult({ ok, message: data?.message ?? "Nothing was sent." });
    setBusy(null);
  };

  return (
    <section className="rounded-2xl border border-bone-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-bone-200 px-5 py-4">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-ink-500">Email marketers</h2>
        <Link href="/admin/marketers/playbook" className="text-[13.5px] font-bold text-forest-500 hover:text-forest-600">
          Edit the playbook
        </Link>
      </header>

      <div className="flex flex-col gap-5 p-5">
        <div className="flex flex-col gap-2">
          <span className={label}>Start from</span>
          <div className="flex flex-wrap gap-1.5">
            {starters.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => applyStarter(s.id)}
                aria-pressed={starter === s.id}
                className={`rounded-full border-[1.5px] px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                  starter === s.id ? "border-forest-500 bg-forest-50 text-forest-700" : "border-bone-200 text-ink-500 hover:border-bone-300"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="flex items-center justify-between gap-3">
            <span className={label}>To ({recipients.length})</span>
            <span className="flex gap-3 text-[12.5px] font-bold">
              <button type="button" onClick={() => setRecipients(marketers.filter((m) => m.active).map((m) => m.id))} className="text-forest-500 hover:text-forest-600">
                All active
              </button>
              <button type="button" onClick={() => setRecipients([])} className="text-ink-400 hover:text-ink-900">
                None
              </button>
            </span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {marketers.map((m) => (
              <label
                key={m.id}
                className={`flex cursor-pointer items-center gap-2 rounded-full border-[1.5px] px-3 py-1.5 text-[13px] font-semibold ${
                  recipients.includes(m.id) ? "border-forest-500 bg-forest-50 text-forest-700" : "border-bone-200 text-ink-500"
                }`}
              >
                <input type="checkbox" checked={recipients.includes(m.id)} onChange={() => toggle(m.id)} className="h-4 w-4 accent-forest-500" />
                {m.name}
              </label>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className={label}>Subject</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className={field} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={label}>Message</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={9}
            className="w-full rounded-xl border-[1.5px] border-bone-200 bg-white px-4 py-3 text-[14.5px] leading-relaxed outline-none focus:border-forest-500"
          />
          <span className="text-[12.5px] leading-relaxed text-ink-400">
            Written once, personalised for each person. <span className="font-mono">**bold**</span>,{" "}
            <span className="font-mono">-</span> bullets and a blank line for a new paragraph all work.
          </span>
        </label>

        <details className="rounded-xl border border-bone-200">
          <summary className="cursor-pointer px-4 py-3 text-[12.5px] font-bold uppercase tracking-[0.07em] text-ink-500">
            Personal fields you can use
          </summary>
          <ul className="grid gap-1 border-t border-bone-200 p-3 sm:grid-cols-2">
            {fieldHelp.map((f) => (
              <li key={f.field} className="flex items-baseline gap-2 px-1 py-1">
                <button
                  type="button"
                  onClick={() => setMessage((msg) => `${msg}{{${f.field}}}`)}
                  className="shrink-0 font-mono text-[12.5px] font-semibold text-forest-600 hover:underline"
                >
                  {`{{${f.field}}}`}
                </button>
                <span className="text-[12.5px] text-ink-400">{f.means}</span>
              </li>
            ))}
          </ul>
        </details>

        <div className="flex flex-col gap-2">
          <span className={label}>Add underneath</span>
          <div className="flex flex-col gap-1.5">
            {Object.entries(includeLabels).map(([key, text]) => (
              <label key={key} className="flex items-center gap-2.5 text-[14px] text-ink-700">
                <input
                  type="checkbox"
                  checked={include.includes(key)}
                  onChange={() => setInclude((all) => (all.includes(key) ? all.filter((k) => k !== key) : [...all, key]))}
                  className="h-4.5 w-4.5 accent-forest-500"
                />
                {text}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={doPreview} disabled={!ready || busy !== null} className={ghost}>
            {busy === "preview" ? "Building…" : "Preview"}
          </button>
          <button
            type="button"
            onClick={doSend}
            disabled={!ready || busy !== null}
            className="inline-flex min-h-[46px] items-center rounded-full bg-forest-500 px-5 text-[14.5px] font-bold text-white transition-colors hover:bg-forest-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "send" ? "Sending…" : `Send to ${recipients.length}`}
          </button>
          <Note result={result} />
        </div>

        {preview && (
          <div className="flex flex-col gap-2 rounded-xl border border-bone-200 bg-bone-50 p-3">
            <p className="px-1 text-[12.5px] text-ink-500">
              As <span className="font-semibold">{preview.to}</span> will see it — subject:{" "}
              <span className="font-semibold text-ink-800">{preview.subject}</span>
            </p>
            <iframe
              title="Email preview"
              srcDoc={preview.html}
              sandbox=""
              className="h-[640px] w-full rounded-lg border border-bone-200 bg-white"
            />
          </div>
        )}
      </div>
    </section>
  );
}
