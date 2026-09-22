"use client";

import { useState } from "react";

type Result = {
  ok: boolean;
  stage?: string;
  from?: string;
  to?: string;
  name?: string;
  message?: string;
  id?: string;
};

const ADVICE: Record<string, string> = {
  validation_error:
    "Resend rejected the request itself. Nine times out of ten this is EMAIL_FROM: it must be an address on a domain you have verified in Resend, written as either name@domain or Name <name@domain>.",
  not_found:
    "Resend could not find the sending domain. Verify it under Domains in Resend, wait for it to read Verified, then try again.",
  invalid_api_key:
    "The key in RESEND_API_KEY is not valid. Create a fresh one in Resend under API Keys, paste it into Vercel, and redeploy.",
  restricted_api_key:
    "That key does not have permission to send. Create one with full access in Resend.",
  missing_required_field:
    "Resend says a required field was missing — almost always a malformed EMAIL_FROM.",
};

/** Resend's test mode only delivers to the account owner's own address. */
const TESTING_HINT =
  "Resend only lets you email your own address until a domain is verified. That is why real buyers get nothing while a test to yourself works. Verify your domain under Domains in Resend, then set EMAIL_FROM to an address on it.";

export function TestEmail({ suggested }: { suggested: string }) {
  const [to, setTo] = useState(suggested);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const send = async () => {
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      setResult((await response.json()) as Result);
    } catch {
      setResult({ ok: false, stage: "network", message: "Could not reach the server." });
    } finally {
      setBusy(false);
    }
  };

  const advice =
    result && !result.ok
      ? (result.name && ADVICE[result.name]) ||
        (/testing emails|own email address/i.test(result.message ?? "")
          ? TESTING_HINT
          : null)
      : null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[14px] leading-relaxed text-ink-500">
        This sends one real email through Resend and shows you exactly what came
        back — including the error, word for word. It is the fastest way to tell
        a configuration problem from a delivery one.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[240px] flex-1 flex-col gap-2">
          <span className="text-[13px] font-bold text-ink-800">Send a test to</span>
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="you@example.com"
            className="min-h-[48px] rounded-xl border-[1.5px] border-bone-200 bg-white px-4 text-[15px] outline-none transition-colors focus:border-forest-500"
          />
        </label>
        <button
          type="button"
          onClick={send}
          disabled={busy}
          className="min-h-[48px] shrink-0 rounded-full bg-forest-500 px-5 text-[14.5px] font-bold text-white transition-colors hover:bg-forest-600 disabled:opacity-60"
        >
          {busy ? "Sending…" : "Send test email"}
        </button>
      </div>

      {result && (
        <div
          role="status"
          className={`rounded-xl border-[1.5px] p-4 ${
            result.ok
              ? "border-forest-200 bg-forest-50"
              : "border-clay-400/40 bg-clay-400/8"
          }`}
        >
          <p
            className={`text-[14.5px] font-bold ${
              result.ok ? "text-forest-700" : "text-clay-400"
            }`}
          >
            {result.ok
              ? "Resend accepted it."
              : `Failed at the ${result.stage} stage.`}
          </p>

          {result.ok ? (
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-500">
              Sent from <code className="font-mono">{result.from}</code> to{" "}
              <code className="font-mono">{result.to}</code>. It should appear in
              your Resend log within a few seconds. If it never arrives, the
              problem is delivery (spam folder, or the recipient&apos;s server),
              not configuration.
            </p>
          ) : (
            <>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-white/70 p-3 font-mono text-[12.5px] leading-relaxed text-ink-800">
                {result.name ? `${result.name}\n` : ""}
                {result.message}
                {result.from ? `\n\nfrom: ${result.from}` : ""}
                {result.to ? `\nto:   ${result.to}` : ""}
              </pre>
              {advice && (
                <p className="mt-3 text-[13.5px] leading-relaxed text-ink-700">
                  <strong>What this usually means:</strong> {advice}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
