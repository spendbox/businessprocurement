import { Panel } from "../AdminUI";
import { TestEmail } from "./DiagnosticsUI";

export const dynamic = "force-dynamic";

/**
 * What the deployment actually has, as it sees it right now.
 *
 * Values are never printed for anything secret — only whether it is there,
 * and how long it is, which is enough to catch a truncated paste. Settings
 * that are not secret (the from address, the recipients) are shown in full,
 * because getting those wrong is the usual cause of silence.
 */

type Check = {
  label: string;
  env: string;
  present: boolean;
  /** Shown verbatim — only ever for non-secret values. */
  value?: string;
  /** Shown instead of the value for secrets. */
  shape?: string;
  required: boolean;
  note?: string;
};

function buildChecks(): { group: string; checks: Check[] }[] {
  const key = process.env.RESEND_API_KEY ?? "";
  const from = process.env.EMAIL_FROM ?? "";
  const internal = process.env.EMAIL_TO_INTERNAL ?? "";
  const secret = process.env.ADMIN_SESSION_SECRET ?? "";

  return [
    {
      group: "Email",
      checks: [
        {
          label: "Resend API key",
          env: "RESEND_API_KEY",
          present: Boolean(key),
          shape: key ? `${key.slice(0, 3)}… ${key.length} characters` : undefined,
          required: true,
          note: key && !key.startsWith("re_")
            ? "Resend keys normally start with re_ — check this was pasted in full."
            : undefined,
        },
        {
          label: "Sends from",
          env: "EMAIL_FROM",
          present: Boolean(from),
          value: from,
          required: true,
          note: !from
            ? "Unset, so sending falls back to onboarding@resend.dev, which can only email your own account address."
            : !/@/.test(from)
              ? "This does not contain an @ — it must be name@domain or Name <name@domain>."
              : undefined,
        },
        {
          label: "Your team receives at",
          env: "EMAIL_TO_INTERNAL",
          present: Boolean(internal),
          value: internal,
          required: true,
          note: !internal
            ? "Unset, so nobody on your side is emailed when a request comes in."
            : undefined,
        },
        {
          label: "Replies go to",
          env: "EMAIL_REPLY_TO",
          present: Boolean(process.env.EMAIL_REPLY_TO),
          value: process.env.EMAIL_REPLY_TO ?? "",
          required: false,
        },
      ],
    },
    {
      group: "Database",
      checks: [
        {
          label: "Supabase URL",
          env: "NEXT_PUBLIC_SUPABASE_URL",
          present: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
          value: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
          required: false,
          note: !process.env.NEXT_PUBLIC_SUPABASE_URL
            ? "Without this, requests are emailed but not stored, and these dashboard pages stay empty."
            : undefined,
        },
        {
          label: "Supabase service role key",
          env: "SUPABASE_SERVICE_ROLE_KEY",
          present: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
          shape: process.env.SUPABASE_SERVICE_ROLE_KEY
            ? `${process.env.SUPABASE_SERVICE_ROLE_KEY.length} characters`
            : undefined,
          required: false,
        },
      ],
    },
    {
      group: "Dashboard",
      checks: [
        {
          label: "Sign-in email",
          env: "ADMIN_EMAIL",
          present: Boolean(process.env.ADMIN_EMAIL),
          value: process.env.ADMIN_EMAIL ?? "",
          required: true,
        },
        {
          label: "Sign-in password",
          env: "ADMIN_PASSWORD",
          present: Boolean(process.env.ADMIN_PASSWORD),
          shape: process.env.ADMIN_PASSWORD
            ? `${process.env.ADMIN_PASSWORD.length} characters`
            : undefined,
          required: true,
        },
        {
          label: "Session secret",
          env: "ADMIN_SESSION_SECRET",
          present: secret.length >= 16,
          shape: secret ? `${secret.length} characters` : undefined,
          required: true,
          note:
            secret && secret.length < 16
              ? "Too short — it must be at least 16 characters, and 32 is better."
              : undefined,
        },
      ],
    },
    {
      group: "Other",
      checks: [
        {
          label: "Site address",
          env: "NEXT_PUBLIC_SITE_URL",
          present: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
          value: process.env.NEXT_PUBLIC_SITE_URL ?? "",
          required: false,
        },
        {
          label: "Category model key",
          env: "OPENAI_API_KEY",
          present: Boolean(process.env.OPENAI_API_KEY),
          shape: process.env.OPENAI_API_KEY ? "set" : undefined,
          required: false,
          note: !process.env.OPENAI_API_KEY
            ? "Not set, so categories are worked out by the built-in keyword matcher. Nothing is broken."
            : undefined,
        },
      ],
    },
  ];
}

function Dot({ ok, required }: { ok: boolean; required: boolean }) {
  const tone = ok
    ? "bg-forest-500"
    : required
      ? "bg-clay-400"
      : "bg-bone-300";
  return <span aria-hidden className={`mt-[7px] h-2.5 w-2.5 shrink-0 rounded-full ${tone}`} />;
}

export default function DiagnosticsPage() {
  const groups = buildChecks();
  const broken = groups
    .flatMap((g) => g.checks)
    .filter((c) => c.required && !c.present);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[30px] font-bold tracking-[-0.025em] text-ink-900">
          Diagnostics
        </h1>
        <p className="mt-1 max-w-[65ch] text-[14.5px] leading-relaxed text-ink-400">
          What this deployment can actually see, read live from the running
          server. If something here is wrong, no amount of retrying the form
          will help.
        </p>
      </div>

      {broken.length > 0 ? (
        <div className="rounded-2xl border-[1.5px] border-clay-400/40 bg-clay-400/8 p-5">
          <p className="text-[15px] font-bold text-clay-400">
            {broken.length} required setting{broken.length === 1 ? " is" : "s are"} missing
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {broken.map((c) => (
              <li key={c.env} className="font-mono text-[13.5px] text-ink-700">
                {c.env}
              </li>
            ))}
          </ul>
          <p className="mt-3 max-w-[65ch] text-[13.5px] leading-relaxed text-ink-600">
            Add them in Vercel under Settings → Environment Variables, tick the
            Production environment, and then <strong>redeploy</strong> — a new
            variable does nothing until the next deploy picks it up.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border-[1.5px] border-forest-200 bg-forest-50 p-5">
          <p className="text-[15px] font-bold text-forest-700">
            Every required setting is present
          </p>
          <p className="mt-1.5 max-w-[65ch] text-[13.5px] leading-relaxed text-ink-600">
            If mail still is not arriving, send yourself a test below — the
            error Resend returns will say why.
          </p>
        </div>
      )}

      <Panel title="Send a test email">
        <TestEmail suggested={process.env.EMAIL_TO_INTERNAL?.split(",")[0]?.trim() ?? ""} />
      </Panel>

      {groups.map((group) => (
        <Panel key={group.group} title={group.group}>
          <ul className="flex flex-col divide-y divide-bone-200">
            {group.checks.map((c) => (
              <li key={c.env} className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0">
                <Dot ok={c.present} required={c.required} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2.5">
                    <span className="text-[14.5px] font-bold text-ink-900">{c.label}</span>
                    <code className="font-mono text-[12px] text-ink-300">{c.env}</code>
                    {!c.required && (
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-300">
                        optional
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 break-all font-mono text-[13px] text-ink-600">
                    {c.present
                      ? (c.value || c.shape || "set")
                      : c.required
                        ? "NOT SET"
                        : "not set"}
                  </p>
                  {c.note && (
                    <p className="mt-1.5 max-w-[70ch] text-[13px] leading-relaxed text-ink-400">
                      {c.note}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      ))}

      <Panel title="Where the server logs are">
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-[14px] leading-relaxed text-ink-600">
          <li>Open your project on vercel.com.</li>
          <li>
            Click the <strong>Logs</strong> tab at the top (not the build log on
            a deployment — that only covers the build).
          </li>
          <li>
            Set the level filter to include <strong>Warning</strong> and{" "}
            <strong>Error</strong>, and widen the time range.
          </li>
          <li>
            Search for <code className="rounded bg-bone-200 px-1.5 py-0.5 font-mono text-[13px]">spendbox</code>{" "}
            — every line this app writes is prefixed with it.
          </li>
        </ol>
        <p className="mt-4 max-w-[70ch] text-[13.5px] leading-relaxed text-ink-400">
          Logs only appear once a request has actually hit the server, and
          Vercel keeps them for a limited window on the free plan. If the Logs
          tab is empty, submit the form once and look again straight away.
        </p>
      </Panel>
    </div>
  );
}
