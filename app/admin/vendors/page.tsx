import Link from "next/link";
import { Suspense } from "react";
import { requireAdminPage } from "@/lib/admin-guard";
import { DataUnavailable, VENDOR_STATUSES, listVendors } from "@/lib/admin-data";
import { listTeamQuietly } from "@/lib/team";
import { agreementStatusByVendor } from "@/lib/agreements";
import { DiscountEditor, MarketerPicker } from "./VendorControls";
import { CATEGORY_OPTIONS } from "@/lib/catalog";
import { Filters } from "../Filters";
import { AssignOwner, DeleteVendor, StatusSelect } from "../AdminUI";
import { NeedsDatabase } from "../Empty";

export const dynamic = "force-dynamic";

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage();

  const params = await searchParams;
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const [everyone, agreements] = await Promise.all([listTeamQuietly(), agreementStatusByVendor()]);
  /* Staff look after merchants; marketers work them. Two different lists. */
  const team = everyone.filter((m) => m.role !== "marketer");
  const marketers = everyone
    .filter((m) => m.role === "marketer" && m.active)
    .map((m) => ({ id: m.id, name: m.name }));

  let vendors;
  try {
    vendors = await listVendors({
      status: one("status"),
      category: one("category"),
      search: one("q"),
    });
  } catch (error) {
    if (error instanceof DataUnavailable) return <NeedsDatabase detail={error.message} />;
    throw error;
  }

  const pending = vendors.filter((v) => v.status === "pending").length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[30px] font-bold tracking-[-0.025em] text-ink-900">
            Merchants
          </h1>
          <p className="mt-1 text-[14.5px] text-ink-400">
            {vendors.length} shown
            {pending > 0 && ` · ${pending} waiting on a decision`}
            {" · approving one emails them straight away"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/vendors/agreement-template"
            className="inline-flex min-h-[46px] shrink-0 items-center rounded-full border-[1.5px] border-ink-900 px-4 text-[14px] font-bold text-ink-900 transition-colors hover:bg-ink-900 hover:text-bone-50"
          >
            Agreement template
          </Link>
          <Link
            href="/admin/vendors/new"
            className="inline-flex min-h-[46px] shrink-0 items-center rounded-full bg-forest-500 px-5 text-[14.5px] font-bold text-white transition-colors hover:bg-forest-600"
          >
            Add a merchant
          </Link>
        </div>
      </div>

      <Suspense fallback={null}>
        <Filters
          searchPlaceholder="Search company, reference or contact"
          filters={[
            { name: "status", label: "Status", options: VENDOR_STATUSES },
            { name: "category", label: "Supplies", options: CATEGORY_OPTIONS },
          ]}
        />
      </Suspense>

      {vendors.length === 0 ? (
        <p className="rounded-2xl border border-bone-200 bg-white px-5 py-10 text-center text-[14.5px] text-ink-400">
          No merchants match those filters.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {vendors.map((v) => (
            <li
              key={v.id}
              className="rounded-2xl border border-bone-200 bg-white p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="text-[16px] font-bold text-ink-900">
                      {v.company}
                    </span>
                    <span className="font-mono text-[12px] text-ink-300">
                      {v.reference}
                    </span>
                    {v.added_by_admin && (
                      <span className="rounded-full border border-bone-300 bg-bone-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink-400">
                        added by hand
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-[13.5px] text-ink-400">
                    {v.contact_name}
                    {v.role ? ` · ${v.role}` : ""} ·{" "}
                    <a
                      href={`mailto:${v.email}`}
                      className="font-semibold text-forest-500 hover:text-forest-600"
                    >
                      {v.email}
                    </a>{" "}
                    · {v.phone}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-start justify-end gap-2">
                  <StatusSelect
                    kind="vendor"
                    id={v.id}
                    value={v.status}
                    options={VENDOR_STATUSES}
                  />
                  <DeleteVendor id={v.id} company={v.company} />
                </div>
              </div>

              <p className="mt-3 max-w-[80ch] text-[14px] leading-relaxed text-ink-600">
                {v.supply_description}
              </p>

              <div className="mt-3.5 flex flex-col gap-2.5 border-t border-bone-200 pt-3">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5">
                  <DiscountEditor
                    vendorId={v.id}
                    min={v.discount_min ?? null}
                    max={v.discount_max ?? null}
                  />
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[12px] font-bold uppercase tracking-[0.07em] text-ink-300">
                      Agreement
                    </span>
                    {agreements[v.id] ? (
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11.5px] font-bold uppercase tracking-wide ${
                          agreements[v.id].status === "signed"
                            ? "border-forest-500 bg-forest-500 text-white"
                            : agreements[v.id].status === "sent"
                              ? "border-amber-400/40 bg-amber-400/15 text-amber-500"
                              : "border-bone-300 bg-bone-200 text-ink-400"
                        }`}
                      >
                        {agreements[v.id].status === "sent" ? "awaiting signature" : agreements[v.id].status}
                      </span>
                    ) : (
                      <span className="text-[13px] text-ink-300">none yet</span>
                    )}
                    <Link
                      href={`/admin/vendors/${v.id}/agreement`}
                      className="text-[13px] font-bold text-forest-500 hover:text-forest-600"
                    >
                      {agreements[v.id]?.status === "signed" ? "View" : "Prepare and send"}
                    </Link>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5">
                  <MarketerPicker
                    vendorId={v.id}
                    value={v.marketer_id ?? ""}
                    marketers={marketers}
                  />
                  <AssignOwner
                    vendorId={v.id}
                    value={v.assigned_to ?? ""}
                    team={team.map((m) => ({ id: m.id, name: m.name }))}
                  />
                </div>
              </div>

              <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 border-t border-bone-200 pt-3 text-[13px]">
                {[
                  ["Supplies", v.categories.join(", ")],
                  ["Delivers to", v.regions.join(", ")],
                  ["Speed", v.fulfilment_speed],
                  ["Terms", v.payment_terms],
                  ["Trading", v.years_trading],
                  ["Own logistics", v.own_logistics ? "Yes" : "No"],
                  ["Applied", when(v.created_at)],
                ].map(([k, value]) => (
                  <div key={k} className="flex gap-1.5">
                    <dt className="shrink-0 font-semibold text-ink-300">{k}</dt>
                    <dd className="text-ink-700">{value}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
