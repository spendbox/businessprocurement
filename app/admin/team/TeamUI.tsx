"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MIN_PASSWORD, ROLES, ROLE_DETAIL, ROLE_LABEL, roleCanSignIn, type Role } from "@/lib/roles";
import type { TeamMemberView } from "@/lib/team";

const field =
  "min-h-[46px] w-full rounded-xl border-[1.5px] border-bone-200 bg-white px-3.5 text-[14.5px] text-ink-800 outline-none transition-colors focus:border-forest-500";

const label = "text-[12px] font-bold uppercase tracking-[0.07em] text-ink-400";

async function call(method: "POST" | "PATCH" | "DELETE", body: unknown) {
  const response = await fetch("/api/admin/team", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as
    | { ok?: boolean; message?: string; errors?: Record<string, string> }
    | null;
  return {
    ok: Boolean(response.ok && data?.ok),
    message: data?.message ?? "Something went wrong.",
    errors: data?.errors ?? {},
  };
}

/* ------------------------------------------------------------------ */
/* Adding someone                                                      */
/* ------------------------------------------------------------------ */

export function AddMember() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("coordinator");
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState("");
  const [startedOn, setStartedOn] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const signsIn = roleCanSignIn(role);
  const ready = name.trim().length > 1 && /.+@.+\..+/.test(email);

  const add = async () => {
    setBusy(true);
    setResult(null);
    setErrors({});
    const outcome = await call("POST", {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      role,
      notes: notes.trim(),
      password: signsIn ? password : "",
      startedOn: signsIn ? "" : startedOn,
    });
    setResult(outcome);
    setErrors(outcome.errors);
    if (outcome.ok) {
      setName("");
      setEmail("");
      setPhone("");
      setPassword("");
      setNotes("");
      router.refresh();
    }
    setBusy(false);
  };

  const problem = (key: string) =>
    errors[key] ? (
      <span className="text-[12.5px] font-semibold text-clay-400">{errors[key]}</span>
    ) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={label}>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
          {problem("name")}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputMode="email"
            className={field}
          />
          {problem("email")}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Phone (optional)</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className={field}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <span className="text-[12.5px] leading-snug text-ink-400">{ROLE_DETAIL[role]}</span>
        </label>
      </div>

      {signsIn ? (
        <label className="flex flex-col gap-1.5">
          <span className={label}>Password — leave blank if they will not sign in</span>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
            placeholder={`At least ${MIN_PASSWORD} characters`}
            className={field}
          />
          {problem("password")}
          <span className="text-[12.5px] leading-snug text-ink-400">
            You will not be able to read it back afterwards, so send it to them
            now — and tell them to sign in at /admin/login with their email.
          </span>
        </label>
      ) : (
        <label className="flex flex-col gap-1.5 sm:max-w-[260px]">
          <span className={label}>Targets start</span>
          <input
            type="date"
            value={startedOn}
            onChange={(e) => setStartedOn(e.target.value)}
            className={field}
          />
          <span className="text-[12.5px] leading-snug text-ink-400">
            Marketers never sign in. Assign them merchants and email them from the
            Marketers page.
          </span>
        </label>
      )}

      <label className="flex flex-col gap-1.5">
        <span className={label}>Notes (optional)</span>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} className={field} />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={add}
          disabled={!ready || busy}
          className="inline-flex min-h-[46px] items-center rounded-full bg-forest-500 px-5 text-[14.5px] font-bold text-white transition-colors hover:bg-forest-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add to the team"}
        </button>
        {result && (
          <span
            role="status"
            className={`text-[13.5px] font-semibold ${
              result.ok ? "text-forest-600" : "text-clay-400"
            }`}
          >
            {result.message}
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One person                                                          */
/* ------------------------------------------------------------------ */

export function MemberRow({
  member,
  vendors,
  isSelf,
  others,
}: {
  member: TeamMemberView;
  vendors: number;
  isSelf: boolean;
  /** People their work could be handed to when they are removed. */
  others: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(member.name);
  const [phone, setPhone] = useState(member.phone ?? "");
  const [role, setRole] = useState<Role>(member.role);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [handTo, setHandTo] = useState("");
  const signsIn = roleCanSignIn(member.role);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async (
    method: "PATCH" | "DELETE",
    body: Record<string, unknown>,
    after?: () => void,
  ) => {
    setBusy(true);
    setMessage(null);
    const outcome = await call(method, { id: member.id, ...body });
    setMessage({ ok: outcome.ok, text: outcome.message });
    if (outcome.ok) {
      after?.();
      router.refresh();
    }
    setBusy(false);
  };

  return (
    <li className="rounded-2xl border border-bone-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-[16px] font-bold text-ink-900">{member.name}</span>
            <span
              className={`rounded-full border px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-wide ${
                member.role === "admin"
                  ? "border-forest-500 bg-forest-500 text-white"
                  : "border-bone-300 bg-bone-100 text-ink-500"
              }`}
            >
              {ROLE_LABEL[member.role]}
            </span>
            {!member.active && (
              <span className="rounded-full border border-clay-400/40 bg-clay-400/12 px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-wide text-clay-400">
                switched off
              </span>
            )}
            {isSelf && (
              <span className="text-[12px] font-semibold text-ink-300">this is you</span>
            )}
          </p>
          <p className="mt-1 text-[13.5px] text-ink-400">
            {member.email}
            {member.phone ? ` · ${member.phone}` : ""}
          </p>
          <p className="mt-1 text-[13px] text-ink-400">
            {!signsIn
              ? "Marketer — never signs in"
              : member.canSignIn
                ? "Can sign in"
                : "No sign-in — a name to assign work to"}
            {" · "}
            {vendors === 0
              ? "no merchants yet"
              : `${vendors} merchant${vendors === 1 ? "" : "s"}`}
            {member.last_login_at
              ? ` · last in ${new Date(member.last_login_at).toLocaleDateString("en-GB")}`
              : ""}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="inline-flex min-h-[40px] items-center rounded-full border-[1.5px] border-bone-300 px-3.5 text-[13px] font-bold text-ink-700 transition-colors hover:border-ink-900"
          >
            {open ? "Close" : "Edit"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run("PATCH", { active: !member.active })}
            className="inline-flex min-h-[40px] items-center rounded-full border-[1.5px] border-bone-300 px-3.5 text-[13px] font-bold text-ink-500 transition-colors hover:border-ink-900 hover:text-ink-900 disabled:opacity-50"
          >
            {member.active ? "Switch off" : "Switch on"}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-4 flex flex-col gap-3 border-t border-bone-200 pt-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5">
              <span className={label}>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={label}>Phone</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={field} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={label}>Role</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className={field}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="-mt-1 text-[12.5px] leading-snug text-ink-400">{ROLE_DETAIL[role]}</p>

          {signsIn && role !== "marketer" && (
          <label className="flex flex-col gap-1.5">
            <span className={label}>
              {member.canSignIn ? "New password" : "Give them a password"}
            </span>
            <input
              type="text"
              value={password}
              autoComplete="off"
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`At least ${MIN_PASSWORD} characters — leave blank to keep as is`}
              className={field}
            />
          </label>
          )}
          {role === "marketer" && member.role !== "marketer" && (
            <p className="text-[12.5px] font-semibold text-amber-500">
              Making them a marketer takes their sign-in away.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(
                  "PATCH",
                  {
                    name: name.trim(),
                    phone: phone.trim(),
                    role,
                    ...(password && roleCanSignIn(role) ? { password } : {}),
                  },
                  () => setPassword(""),
                )
              }
              className="inline-flex min-h-[42px] items-center rounded-full bg-ink-900 px-4 text-[13.5px] font-bold text-bone-50 transition-colors hover:bg-ink-800 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save changes"}
            </button>

            {member.canSignIn && signsIn && (
              <button
                type="button"
                disabled={busy}
                onClick={() => run("PATCH", { removePassword: true })}
                className="inline-flex min-h-[42px] items-center rounded-full border-[1.5px] border-bone-300 px-3.5 text-[13.5px] font-bold text-ink-500 transition-colors hover:border-ink-900 hover:text-ink-900 disabled:opacity-50"
              >
                Take away their sign-in
              </button>
            )}

            {!isSelf &&
              (asking ? (
                <span className="flex flex-wrap items-center gap-2 rounded-xl border-[1.5px] border-clay-400/40 bg-clay-400/8 px-3 py-2">
                  <span className="text-[13px] font-semibold text-ink-700">
                    Remove {member.name}? Hand their work to
                  </span>
                  <select
                    value={handTo}
                    onChange={(e) => setHandTo(e.target.value)}
                    aria-label="Hand their work to"
                    className="min-h-[36px] rounded-lg border-[1.5px] border-bone-200 bg-white px-2 text-[13px] font-semibold text-ink-700"
                  >
                    <option value="">nobody</option>
                    {others.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run("DELETE", { reassignTo: handTo })}
                    className="inline-flex min-h-[36px] items-center rounded-full bg-clay-400 px-3 text-[13px] font-bold text-white disabled:opacity-50"
                  >
                    Yes, remove
                  </button>
                  <button
                    type="button"
                    onClick={() => setAsking(false)}
                    className="text-[13px] font-bold text-ink-500 hover:text-ink-900"
                  >
                    Keep
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setAsking(true)}
                  className="inline-flex min-h-[42px] items-center rounded-full px-3 text-[13.5px] font-bold text-ink-400 transition-colors hover:text-clay-400"
                >
                  Remove from team
                </button>
              ))}
          </div>

          {message && (
            <p
              role="status"
              className={`text-[13px] font-semibold ${
                message.ok ? "text-forest-600" : "text-clay-400"
              }`}
            >
              {message.text}
            </p>
          )}
        </div>
      )}

      {!open && message && (
        <p
          role="status"
          className={`mt-2 text-[13px] font-semibold ${
            message.ok ? "text-forest-600" : "text-clay-400"
          }`}
        >
          {message.text}
        </p>
      )}
    </li>
  );
}
