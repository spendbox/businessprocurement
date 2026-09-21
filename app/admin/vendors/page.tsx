import { Suspense } from "react";
import { DataUnavailable, VENDOR_STATUSES, listVendors } from "@/lib/admin-data";
import { CATEGORY_OPTIONS } from "@/lib/catalog";
import { Filters } from "../Filters";
import { StatusSelect } from "../AdminUI";
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
  const params = await searchParams;
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

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
      <div>
        <h1 className="font-display text-[30px] font-bold tracking-[-0.025em] text-ink-900">
          Merchants
        </h1>
        <p className="mt-1 text-[14.5px] text-ink-400">
          {vendors.length} shown
          {pending > 0 && ` · ${pending} waiting on a decision`}
        </p>
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
                <StatusSelect
                  kind="vendor"
                  id={v.id}
                  value={v.status}
                  options={VENDOR_STATUSES}
                />
              </div>

              <p className="mt-3 max-w-[80ch] text-[14px] leading-relaxed text-ink-600">
                {v.supply_description}
              </p>

              <dl className="mt-3.5 flex flex-wrap gap-x-6 gap-y-1.5 border-t border-bone-200 pt-3 text-[13px]">
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
