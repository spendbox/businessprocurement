import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-guard";
import { TeamUnavailable, listTeam } from "@/lib/team";
import { DOCUMENT_FIELDS, getDocument, targetsFrom } from "@/lib/documents";
import {
  INCLUDE_LABEL,
  STARTERS,
  allVendorsForPicker,
  marketerSummaries,
} from "@/lib/marketers";
import { formatMoney } from "@/lib/invoices";
import { Panel } from "../AdminUI";
import { AddMarketer, MarketersBoard } from "./MarketersUI";

export const dynamic = "force-dynamic";

export default async function MarketersPage() {
  await requireAdminPage();

  let team;
  try {
    team = await listTeam();
  } catch (error) {
    if (error instanceof TeamUnavailable) {
      return (
        <div className="rounded-2xl border-[1.5px] border-amber-400/40 bg-amber-400/8 p-6 sm:p-8">
          <h2 className="font-display text-[20px] font-bold tracking-[-0.015em] text-ink-900">
            Marketers need one more step
          </h2>
          <p className="mt-2 max-w-[62ch] text-[14.5px] leading-relaxed text-ink-500">{error.message}</p>
        </div>
      );
    }
    throw error;
  }

  const playbook = await getDocument("marketer_playbook");
  const targets = targetsFrom(playbook.meta);
  const [summaries, vendors] = await Promise.all([
    marketerSummaries(team, targets),
    allVendorsForPicker(),
  ]);

  const active = summaries.filter((m) => m.active);
  const onPace = active.filter((m) => m.progress.businesses >= targets.targetBusinesses).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[30px] font-bold tracking-[-0.025em] text-ink-900">Marketers</h1>
          <p className="mt-1 max-w-[72ch] text-[14.5px] leading-relaxed text-ink-400">
            Each one aims for{" "}
            <span className="font-semibold text-ink-700">
              {targets.targetBusinesses} businesses in {targets.businessWindowDays} days
            </span>{" "}
            and{" "}
            <span className="font-semibold text-ink-700">
              {formatMoney(targets.targetSales, "NGN").replace(/\.00$/, "")} in sales in{" "}
              {targets.salesWindowDays} days
            </span>
            , counted from their own start date.
            {active.length > 0 && ` ${onPace} of ${active.length} have hit the businesses target.`}
          </p>
        </div>
        <Link
          href="/admin/marketers/playbook"
          className="inline-flex min-h-[44px] shrink-0 items-center rounded-full border-[1.5px] border-ink-900 px-4 text-[14px] font-bold text-ink-900 transition-colors hover:bg-ink-900 hover:text-bone-50"
        >
          The playbook
        </Link>
      </div>

      <p className="rounded-xl border border-bone-200 bg-white px-4 py-3 text-[13.5px] leading-relaxed text-ink-500">
        <span className="font-semibold text-ink-700">How they are counted.</span> A business counts once
        a request from it is marked as brought in by the marketer — set that on the request page. Sales
        count when an invoice for one of their requests is marked paid.
      </p>

      <MarketersBoard
        marketers={summaries.map((m) => ({
          id: m.id,
          name: m.name,
          email: m.email,
          phone: m.phone,
          notes: m.notes,
          active: m.active,
          started_on: m.started_on ?? null,
          created_at: m.created_at,
          lastEmailedAt: m.lastEmailedAt,
          progress: m.progress,
        }))}
        vendors={vendors.map((v) => ({
          id: v.id,
          company: v.company,
          categories: v.categories,
          status: v.status,
          discount_min: v.discount_min,
          discount_max: v.discount_max,
          marketer_id: v.marketer_id,
        }))}
        targets={targets}
        starters={STARTERS.map((s) => ({ ...s, include: [...s.include] }))}
        includeLabels={INCLUDE_LABEL}
        fieldHelp={DOCUMENT_FIELDS.marketer_playbook}
      />

      <Panel title="Add a marketer">
        <p className="mb-4 max-w-[70ch] text-[14px] leading-relaxed text-ink-400">
          Marketers never sign in — they need only a name, an email and a phone number. Their
          targets count from the start date you set. Send them the welcome email and the
          playbook from the box above once they are added.
        </p>
        <AddMarketer />
      </Panel>
    </div>
  );
}
