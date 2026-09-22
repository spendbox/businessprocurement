import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-guard";
import { DataUnavailable, getStats, listRequests } from "@/lib/admin-data";
import { URGENCIES } from "@/lib/catalog";
import { BarList, DailyColumns, StatTile } from "./Charts";
import { Panel, StatusChip, UrgencyChip } from "./AdminUI";
import { NeedsDatabase } from "./Empty";

export const dynamic = "force-dynamic";

const urgencyLabelFor = (value: string) =>
  URGENCIES.find((u) => u.value === value)?.label ?? value;

/** "3h ago" reads faster than a date when the row is minutes old. */
function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** The two initials a person would write on a folder. */
function initials(company: string): string {
  const words = company.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default async function OverviewPage() {
  /* The numbers live here, so only an admin gets this far. */
  await requireAdminPage();

  let stats;
  let recent;
  try {
    [stats, recent] = await Promise.all([
      getStats(),
      listRequests({ limit: 8 }),
    ]);
  } catch (error) {
    if (error instanceof DataUnavailable) {
      return <NeedsDatabase detail={error.message} />;
    }
    throw error;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[30px] font-bold tracking-[-0.025em] text-ink-900">
          Overview
        </h1>
        <p className="mt-1 text-[14.5px] text-ink-400">
          Everything that has come in, and what still needs a hand.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Open requests"
          value={stats.openRequests}
          detail="New, sourcing or quoted"
        />
        <StatTile
          label="Urgent and open"
          value={stats.urgentOpen}
          detail="Needed today or in 1–2 days"
          tone="alert"
        />
        <StatTile
          label="This week"
          value={stats.requestsThisWeek}
          detail={`${stats.totalRequests} all time`}
        />
        <StatTile
          label="Merchants waiting"
          value={stats.pendingVendors}
          detail={`${stats.approvedVendors} approved`}
          tone="alert"
        />
      </div>

      <Panel title="Requests per day, last 14 days">
        <DailyColumns data={stats.daily} />
      </Panel>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel title="Most requested categories">
          <BarList
            data={stats.byCategory}
            emptyMessage="No categories recorded yet."
          />
        </Panel>
        <Panel title="How soon buyers need things">
          <BarList data={stats.byUrgency} emptyMessage="No requests yet." />
        </Panel>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel title="Where requests stand">
          <BarList data={stats.byStatus} emptyMessage="No requests yet." />
          {stats.archivedRequests > 0 && (
            <p className="mt-4 border-t border-bone-200 pt-3 text-[13px] text-ink-400">
              {stats.archivedRequests} cancelled{" "}
              {stats.archivedRequests === 1 ? "request is" : "requests are"} filed
              away in the{" "}
              <Link
                href="/admin/requests?view=archived"
                className="font-bold text-forest-500 hover:text-forest-600"
              >
                archive
              </Link>
              .
            </p>
          )}
        </Panel>

        <Panel title="Categories with no approved merchant">
          {stats.uncoveredCategories.length === 0 ? (
            <p className="text-[14px] text-ink-500">
              Every category has at least one approved merchant.
            </p>
          ) : (
            <>
              <p className="mb-3 text-[13.5px] leading-relaxed text-ink-400">
                A request in one of these has nobody to go to. Approving a
                merchant who supplies it closes the gap.
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {stats.uncoveredCategories.map((c) => (
                  <li
                    key={c}
                    className="rounded-full border border-clay-400/40 bg-clay-400/10 px-3 py-1.5 text-[13px] font-semibold text-clay-400"
                  >
                    {c}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      </div>

      <Panel
        title="Latest requests"
        action={
          <Link
            href="/admin/requests"
            className="text-[13.5px] font-bold text-forest-500 hover:text-forest-600"
          >
            See all
          </Link>
        }
      >
        {recent.length === 0 ? (
          <p className="text-[14px] text-ink-300">Nothing has come in yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {recent.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/admin/requests/${r.id}`}
                  className="group flex items-start gap-3.5 rounded-xl border border-transparent p-3 transition-colors hover:border-bone-200 hover:bg-bone-50"
                >
                  {/* A stable, quiet anchor for the eye down the left. */}
                  <span
                    aria-hidden
                    className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-bone-200 text-[12.5px] font-bold text-ink-500 transition-colors group-hover:bg-forest-50 group-hover:text-forest-700"
                  >
                    {initials(r.company)}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate text-[15px] font-bold text-ink-900">
                        {r.company}
                      </span>
                      <span className="font-mono text-[11.5px] text-ink-300">
                        {r.reference}
                      </span>
                      <span className="text-[12.5px] text-ink-300">
                        · {timeAgo(r.created_at)}
                      </span>
                    </span>

                    <span className="mt-0.5 block line-clamp-1 text-[13.5px] leading-snug text-ink-500">
                      {r.need}
                    </span>

                    {/* Where it goes, what it is, what it is worth. */}
                    <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-400">
                      {[r.city, r.region].filter(Boolean).length > 0 && (
                        <span className="flex items-center gap-1">
                          <svg
                            viewBox="0 0 24 24"
                            aria-hidden
                            className="h-3.5 w-3.5 shrink-0 text-ink-300"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.8}
                          >
                            <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
                            <circle cx="12" cy="10" r="2.5" />
                          </svg>
                          {[r.city, r.region].filter(Boolean).join(", ")}
                        </span>
                      )}
                      {r.categories.length > 0 && (
                        <span className="truncate">{r.categories.slice(0, 2).join(", ")}</span>
                      )}
                      {r.budget && (
                        <span className="font-semibold text-ink-500">{r.budget}</span>
                      )}
                      {r.has_attachment && (
                        <span className="flex items-center gap-1 text-ink-300">
                          <svg
                            viewBox="0 0 24 24"
                            aria-hidden
                            className="h-3.5 w-3.5 shrink-0"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.8}
                          >
                            <path d="M21 11.5 12.5 20a5 5 0 0 1-7-7l8-8a3.5 3.5 0 1 1 5 5l-8 8a2 2 0 0 1-3-3l7.5-7.5" />
                          </svg>
                          file
                        </span>
                      )}
                    </span>
                  </span>

                  <span className="flex shrink-0 flex-col items-end gap-1.5">
                    <UrgencyChip urgency={r.urgency} label={urgencyLabelFor(r.urgency)} />
                    <StatusChip status={r.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
