import Link from "next/link";
import { Suspense } from "react";
import { DataUnavailable, REQUEST_STATUSES, listRequests } from "@/lib/admin-data";
import { CATEGORY_OPTIONS, URGENCIES } from "@/lib/catalog";
import { Filters } from "../Filters";
import { StatusChip, UrgencyChip } from "../AdminUI";
import { NeedsDatabase } from "../Empty";

export const dynamic = "force-dynamic";

const urgencyLabelFor = (value: string) =>
  URGENCIES.find((u) => u.value === value)?.label ?? value;

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  let requests;
  try {
    requests = await listRequests({
      status: one("status"),
      urgency: one("urgency"),
      category: one("category"),
      search: one("q"),
    });
  } catch (error) {
    if (error instanceof DataUnavailable) return <NeedsDatabase detail={error.message} />;
    throw error;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[30px] font-bold tracking-[-0.025em] text-ink-900">
            Requests
          </h1>
          <p className="mt-1 text-[14.5px] text-ink-400">
            {requests.length} {requests.length === 1 ? "request" : "requests"} shown
          </p>
        </div>
      </div>

      <Suspense fallback={null}>
        <Filters
          searchPlaceholder="Search business, reference, contact or item"
          filters={[
            { name: "status", label: "Status", options: REQUEST_STATUSES },
            {
              name: "urgency",
              label: "Urgency",
              options: URGENCIES.map((u) => u.value),
            },
            { name: "category", label: "Category", options: CATEGORY_OPTIONS },
          ]}
        />
      </Suspense>

      {requests.length === 0 ? (
        <p className="rounded-2xl border border-bone-200 bg-white px-5 py-10 text-center text-[14.5px] text-ink-400">
          No requests match those filters.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {requests.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/requests/${r.id}`}
                className="block rounded-2xl border border-bone-200 bg-white p-4 transition-all duration-200 hover:-translate-y-px hover:border-forest-200 hover:shadow-lift sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="text-[16px] font-bold text-ink-900">
                        {r.company}
                      </span>
                      <span className="font-mono text-[12px] text-ink-300">
                        {r.reference}
                      </span>
                    </p>
                    <p className="mt-1 line-clamp-2 max-w-[70ch] text-[14px] leading-snug text-ink-500">
                      {r.need}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <UrgencyChip urgency={r.urgency} label={urgencyLabelFor(r.urgency)} />
                    <StatusChip status={r.status} />
                  </div>
                </div>

                <dl className="mt-3.5 flex flex-wrap gap-x-6 gap-y-1.5 border-t border-bone-200 pt-3 text-[13px]">
                  {[
                    ["Deliver to", [r.city, r.region].filter(Boolean).join(", ")],
                    ["Categories", r.categories.join(", ")],
                    ["Budget", r.budget ?? "—"],
                    ["Received", when(r.created_at)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex gap-1.5">
                      <dt className="font-semibold text-ink-300">{k}</dt>
                      <dd className="text-ink-700">{v}</dd>
                    </div>
                  ))}
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
