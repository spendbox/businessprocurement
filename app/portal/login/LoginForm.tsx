"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { LogoMark } from "@/components/Logo";
import { Check } from "@/components/Icons";

function Form() {
  const params = useSearchParams();
  const expired = params.get("expired") === "1";

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        setError(data?.message ?? "Could not send the link.");
        return;
      }
      setSent(data.message as string);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-3xl border border-bone-200 bg-white p-7 text-center shadow-lift sm:p-9">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-forest-500 text-white">
          <Check className="h-6 w-6" />
        </span>
        <h1 className="mt-5 font-display text-[24px] font-bold tracking-[-0.02em] text-ink-900">
          Check your email
        </h1>
        <p className="mx-auto mt-2 max-w-[34ch] text-[14.5px] leading-relaxed text-ink-500">
          {sent}
        </p>
        <p className="mx-auto mt-4 max-w-[34ch] text-[13.5px] leading-relaxed text-ink-400">
          The link works for 30 minutes. If nothing arrives, check your spam
          folder — or just send a new request; signing in is never required.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-[48px] items-center rounded-full border-[1.5px] border-bone-300 px-5 text-[15px] font-bold text-ink-800 transition-colors hover:border-ink-900"
        >
          Back to Spendbox
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-bone-200 bg-white p-7 shadow-lift sm:p-9">
      <LogoMark className="h-11 w-11" />
      <h1 className="mt-5 font-display text-[26px] font-bold tracking-[-0.02em] text-ink-900">
        Your requests
      </h1>
      <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-400">
        Enter the email you used and we will send a sign-in link. No password to
        remember.
      </p>

      {expired && (
        <p className="mt-5 rounded-xl border-[1.5px] border-amber-400/40 bg-amber-400/10 px-4 py-3 text-[13.5px] font-semibold text-amber-500">
          That link has expired. Enter your email for a fresh one.
        </p>
      )}

      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-[14px] font-bold text-ink-800">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@yourbusiness.com"
            className="min-h-[56px] rounded-2xl border-[1.5px] border-bone-200 bg-bone-50 px-4 text-[16px] text-ink-800 outline-none transition-colors focus:border-forest-500 focus:bg-white focus:ring-4 focus:ring-forest-500/14"
          />
        </label>

        {error && (
          <p
            role="alert"
            className="rounded-xl border-[1.5px] border-clay-400/40 bg-clay-400/10 px-4 py-3 text-[13.5px] font-semibold text-clay-400"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-1 min-h-[56px] rounded-full bg-forest-500 text-[16px] font-bold text-white transition-colors hover:bg-forest-600 disabled:opacity-60"
        >
          {busy ? "Sending…" : "Send me a link"}
        </button>
      </form>

      <p className="mt-6 text-center text-[13.5px] text-ink-400">
        Never sent a request?{" "}
        <Link href="/" className="font-bold text-forest-500 hover:text-forest-600">
          Start one
        </Link>
        {" "}— signing in is optional.
      </p>
    </div>
  );
}

export function LoginForm() {
  return (
    <Suspense fallback={null}>
      <Form />
    </Suspense>
  );
}
