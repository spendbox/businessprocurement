"use client";

import { useState } from "react";

/**
 * The signature itself.
 *
 * Three deliberate acts, so nobody signs by accident: type your full name,
 * say what your role is, and tick a box that says in plain words what
 * ticking it means. The button stays off until all three are done.
 */
export function SignForm({ token, company, contact }: { token: string; company: string; contact: string }) {
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ready = name.trim().length >= 3 && title.trim().length >= 2 && consent;

  const sign = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/agreement/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name: name.trim(), title: title.trim(), consent }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        setError(data?.message ?? "Signing did not go through. Please try again.");
        return;
      }
      setDone(data.message as string);
    } catch {
      setError("We could not reach Spendbox. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div role="status" className="rounded-2xl border-[1.5px] border-forest-500 bg-forest-50 p-6">
        <p className="font-display text-[22px] font-bold text-forest-700">Thank you — it is signed.</p>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-600">{done}</p>
        <p className="mt-3 text-[14px] text-ink-500">You can close this page.</p>
      </div>
    );
  }

  const field =
    "min-h-[52px] w-full rounded-xl border-[1.5px] border-bone-200 bg-white px-4 text-[16px] text-ink-800 outline-none transition-colors focus:border-forest-500 focus:ring-4 focus:ring-forest-500/14";

  return (
    <form onSubmit={sign} className="flex flex-col gap-4 rounded-2xl border border-bone-200 bg-white p-6 shadow-lift">
      <div>
        <p className="font-display text-[22px] font-bold tracking-[-0.015em] text-ink-900">Sign for {company}</p>
        <p className="mt-1 text-[14px] leading-relaxed text-ink-400">
          Typing your name below is your electronic signature. It has the same effect as signing on paper.
        </p>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-[13.5px] font-bold text-ink-800">Your full name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder={contact} className={field} />
      </label>
      {name.trim().length >= 3 && (
        <p aria-hidden className="-mt-1 px-1 font-serif text-[30px] italic leading-tight text-ink-900">{name}</p>
      )}

      <label className="flex flex-col gap-2">
        <span className="text-[13.5px] font-bold text-ink-800">Your title or role</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} autoComplete="organization-title" placeholder="Managing Director" className={field} />
      </label>

      <label className="flex items-start gap-3 rounded-xl border-[1.5px] border-bone-200 bg-bone-50 p-4">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-forest-500" />
        <span className="text-[14.5px] leading-relaxed text-ink-700">
          I have read this agreement, I am authorised to sign it for <strong>{company}</strong>, and I agree
          to it. I understand that typing my name above is my signature.
        </span>
      </label>

      {error && (
        <p role="alert" className="rounded-xl border-[1.5px] border-clay-400/40 bg-clay-400/10 px-4 py-3 text-[14px] font-semibold text-clay-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!ready || busy}
        className="min-h-[54px] rounded-full bg-forest-500 text-[16px] font-bold text-white transition-colors hover:bg-forest-600 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {busy ? "Signing…" : "Sign the agreement"}
      </button>
      <p className="text-center text-[12.5px] text-ink-300">
        We record the time, your name and the address you signed from. A signed copy is emailed to you.
      </p>
    </form>
  );
}
