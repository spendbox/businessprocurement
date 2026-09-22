import Link from "next/link";
import { Suspense } from "react";
import {
  DataUnavailable,
  REQUEST_STATUSES,
  listRequests,
  type ArchiveView,
} from "@/lib/admin-data";
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

  /* The archive is a view of the same list, not a different page. */
  const requested = one("view");
  const view: ArchiveView =
    requested === "archived" || requested === "all" ? requested : "active";

  const VIEWS: { value: ArchiveView; label: string; detail: string }[] = [
    { value: "active", label: "Working list", detail: "Everything still live" },
    { value: "archived", label: "Archive", detail: "Cancelled and filed away" },
    { value: "all", label: "Everything", detail: "Both at once" },
  ];

  const linkFor = (next: ArchiveView) => {
    const query = new URLSearchParams();
    for (const key of ["status", "urgency", "category", "q"]) {
      const value = one(key);
      if (value) query.set(key, value);
    }
    if (next !== "active") query.set("view", next);
    const search = query.toString();
    return search ? `/admin/requests?${search}` : "/admin/requests";
  };

  let requests;
  try {
    requests = await listRequests({
      status: one("status"),
      urgency: one("urgency"),
      category: one("category"),
      search: one("q"),
      archive: view,
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
            {view === "archived" ? "Archived requests" : "Requests"}
          </h1>
          <p className="mt-1 text-[14.5px] text-ink-400">
            {requests.length} {requests.length === 1 ? "request" : "requests"} shown
            {view === "active" && " · cancelled ones are in the archive"}
          </p>
        </div>
      </div>

      <nav
        aria-label="Which requests to show"
        className="flex w-full gap-1 overflow-x-auto rounded-2xl border border-bone-200 bg-white p-1 sm:w-auto sm:self-start"
      >
        {VIEWS.map((v) => (
          <Link
            key={v.value}
            href={linkFor(v.value)}
            title={v.detail}
            aria-current={v.value === view ? "page" : undefined}
            className={`shrink-0 rounded-xl px-3.5 py-2 text-[13.5px] font-bold transition-colors ${
              v.value === view
                ? "bg-ink-900 text-bone-50"
                : "text-ink-500 hover:bg-bone-100 hover:text-ink-900"
            }`}
          >
            {v.label}
          </Link>
        ))}
      </nav>

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
          {view === "archived"
            ? "Nothing in the archive. Cancelling a request files it here."
            : "No requests match those filters."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {requests.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/requests/${r.id}`}
                className={`block rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-px hover:border-forest-200 hover:shadow-lift sm:p-5 ${
                  r.archived_at
                    ? "border-bone-300 bg-bone-50"
                    : "border-bone-200 bg-white"
                }`}
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
                    {r.archived_at && (
                      <span className="inline-flex shrink-0 items-center rounded-full border border-bone-300 bg-bone-200 px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-wide text-ink-400">
                        archived
                      </span>
                    )}
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
