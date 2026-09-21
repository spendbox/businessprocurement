import Link from "next/link";
import { DataUnavailable, getStats, listRequests } from "@/lib/admin-data";
import { URGENCIES } from "@/lib/catalog";
import { BarList, DailyColumns, StatTile } from "./Charts";
import { Panel, StatusChip, UrgencyChip } from "./AdminUI";
import { NeedsDatabase } from "./Empty";

export const dynamic = "force-dynamic";

const urgencyLabelFor = (value: string) =>
  URGENCIES.find((u) => u.value === value)?.label ?? value;

export default async function OverviewPage() {
  let stats;
  let recent;
  try {
    [stats, recent] = await Promise.all([
      getStats(),
      listRequests({ limit: 6 }),
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
          <ul className="flex flex-col divide-y divide-bone-200">
            {recent.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/admin/requests/${r.id}`}
                  className="flex flex-col gap-2 py-3.5 transition-colors first:pt-0 last:pb-0 hover:bg-bone-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14.5px] font-bold text-ink-900">
                      {r.company}
                    </span>
                    <span className="block truncate text-[13px] text-ink-400">
                      {r.need}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
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
