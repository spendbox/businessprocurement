import Link from "next/link";

/** Shown wherever the dashboard needs Supabase and has not got it. */
export function NeedsDatabase({ detail }: { detail: string }) {
  return (
    <div className="rounded-2xl border-[1.5px] border-amber-400/40 bg-amber-400/8 p-6 sm:p-8">
      <h2 className="font-display text-[20px] font-bold tracking-[-0.015em] text-ink-900">
        Nothing to show yet
      </h2>
      <p className="mt-2 max-w-[60ch] text-[14.5px] leading-relaxed text-ink-500">
        {detail}
      </p>
      <p className="mt-4 max-w-[60ch] text-[14px] leading-relaxed text-ink-500">
        The dashboard reads from Supabase. Requests still reach you by email
        without it, but they are not stored anywhere this page can list. To turn
        it on: create a Supabase project, run{" "}
        <code className="rounded bg-bone-200 px-1.5 py-0.5 font-mono text-[13px]">
          supabase/schema.sql
        </code>{" "}
        in its SQL editor, then set{" "}
        <code className="rounded bg-bone-200 px-1.5 py-0.5 font-mono text-[13px]">
          NEXT_PUBLIC_SUPABASE_URL
        </code>{" "}
        and{" "}
        <code className="rounded bg-bone-200 px-1.5 py-0.5 font-mono text-[13px]">
          SUPABASE_SERVICE_ROLE_KEY
        </code>{" "}
        in Vercel and redeploy.
      </p>
      <Link
        href="/"
        className="mt-5 inline-flex min-h-[44px] items-center rounded-full border-[1.5px] border-ink-900 px-4 text-[14px] font-bold text-ink-900 transition-colors hover:bg-ink-900 hover:text-bone-50"
      >
        Back to the site
      </Link>
    </div>
  );
}
