"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { LogoMark } from "@/components/Logo";

function Form({ problem }: { problem: string | null }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        setError(data?.message ?? "Could not sign you in.");
        return;
      }
      router.replace(next && next.startsWith("/admin") ? next : "/admin");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  const field =
    "w-full rounded-xl border-[1.5px] border-bone-200 bg-bone-50 px-4 py-3 text-[15px] text-ink-800 outline-none transition-colors focus:border-forest-500 focus:bg-white focus:ring-4 focus:ring-forest-500/14 min-h-[50px]";

  return (
    <div className="rounded-3xl border border-bone-200 bg-white p-7 shadow-lift sm:p-9">
      <LogoMark className="h-11 w-11" />
      <h1 className="mt-5 font-display text-[26px] font-bold tracking-[-0.02em] text-ink-900">
        Dashboard
      </h1>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-400">
        Sign in to see requests, merchants and what is coming in.
      </p>

      {problem ? (
        <div className="mt-6 rounded-xl border-[1.5px] border-amber-400/40 bg-amber-400/10 px-4 py-4">
          <p className="text-[14px] font-bold text-amber-500">Not set up yet</p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-500">
            {problem} Add it in Vercel under Settings → Environment Variables,
            then redeploy. The README lists all three values the dashboard needs.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-7 flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-[13px] font-bold text-ink-800">Email</span>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={field}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-[13px] font-bold text-ink-800">Password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={field}
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
            className="mt-1 min-h-[52px] rounded-full bg-forest-500 text-[15px] font-bold text-white transition-colors hover:bg-forest-600 disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      )}
    </div>
  );
}

export function LoginForm({ problem }: { problem: string | null }) {
  return (
    <Suspense fallback={null}>
      <Form problem={problem} />
    </Suspense>
  );
}
