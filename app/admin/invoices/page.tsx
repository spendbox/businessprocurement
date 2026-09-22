import Link from "next/link";
import { Suspense } from "react";
import {
  DataUnavailable,
  InvoicesUnavailable,
  listInvoices,
} from "@/lib/admin-data";
import {
  INVOICE_STATUSES,
  formatMoney,
  prettyDate,
  type InvoiceRow,
} from "@/lib/invoices";
import { requireAdminPage } from "@/lib/admin-guard";
import { Filters } from "../Filters";
import { Panel, StatusChip, StatusSelect } from "../AdminUI";
import { InvoiceActions, InvoiceBuilder } from "../InvoiceUI";
import { NeedsDatabase } from "../Empty";

export const dynamic = "force-dynamic";

/** Money owed, grouped the way a person thinks about it. */
function outstanding(invoices: InvoiceRow[]) {
  const unpaid = invoices.filter((i) => i.status === "sent" || i.status === "draft");
  const totals = new Map<string, number>();
  for (const invoice of unpaid) {
    totals.set(
      invoice.currency,
      (totals.get(invoice.currency) ?? 0) + Number(invoice.total),
    );
  }
  return [...totals.entries()].map(([currency, total]) => formatMoney(total, currency));
}

export default async function InvoicesPage({
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

  let invoices;
  try {
    invoices = await listInvoices({ status: one("status"), search: one("q") });
  } catch (error) {
    if (error instanceof InvoicesUnavailable) {
      return (
        <div className="rounded-2xl border-[1.5px] border-amber-400/40 bg-amber-400/8 p-6 sm:p-8">
          <h2 className="font-display text-[20px] font-bold tracking-[-0.015em] text-ink-900">
            Invoices need one more step
          </h2>
          <p className="mt-2 max-w-[62ch] text-[14.5px] leading-relaxed text-ink-500">
            {error.message}
          </p>
          <p className="mt-4 max-w-[62ch] text-[14px] leading-relaxed text-ink-500">
            Open your Supabase project, go to the SQL editor, paste the contents
            of{" "}
            <code className="rounded bg-bone-200 px-1.5 py-0.5 font-mono text-[13px]">
              supabase/schema.sql
            </code>{" "}
            and run it. It is safe to run on a database that already has data —
            it only adds what is missing.
          </p>
        </div>
      );
    }
    if (error instanceof DataUnavailable) return <NeedsDatabase detail={error.message} />;
    throw error;
  }

  const owed = outstanding(invoices);
  const paid = invoices.filter((i) => i.status === "paid").length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-[30px] font-bold tracking-[-0.025em] text-ink-900">
          Invoices
        </h1>
        <p className="mt-1 text-[14.5px] text-ink-400">
          {invoices.length} {invoices.length === 1 ? "invoice" : "invoices"}
          {owed.length > 0 && ` · ${owed.join(" and ")} outstanding`}
          {paid > 0 && ` · ${paid} paid`}
        </p>
      </div>

      <Suspense fallback={null}>
        <Filters
          searchPlaceholder="Search reference, business or request"
          filters={[{ name: "status", label: "Status", options: INVOICE_STATUSES }]}
        />
      </Suspense>

      {invoices.length === 0 ? (
        <p className="rounded-2xl border border-bone-200 bg-white px-5 py-10 text-center text-[14.5px] text-ink-400">
          No invoices yet. Raise one below, or from any request.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {invoices.map((invoice) => (
            <li
              key={invoice.id}
              className="rounded-2xl border border-bone-200 bg-white p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="text-[16px] font-bold text-ink-900">
                      {invoice.bill_to_company}
                    </span>
                    <span className="font-mono text-[12px] text-ink-300">
                      {invoice.reference}
                    </span>
                    <StatusChip status={invoice.status} />
                  </p>
                  <p className="mt-1 text-[13.5px] text-ink-400">
                    {invoice.bill_to_email}
                    {invoice.request_id && invoice.request_reference && (
                      <>
                        {" · "}
                        <Link
                          href={`/admin/requests/${invoice.request_id}`}
                          className="font-semibold text-forest-500 hover:text-forest-600"
                        >
                          {invoice.request_reference}
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="font-display text-[22px] font-bold tabular-nums leading-none text-ink-900">
                    {formatMoney(invoice.total, invoice.currency)}
                  </span>
                  <StatusSelect
                    kind="invoice"
                    id={invoice.id}
                    value={invoice.status}
                    options={INVOICE_STATUSES}
                  />
                </div>
              </div>

              <div className="mt-3.5 flex flex-wrap items-end justify-between gap-3 border-t border-bone-200 pt-3">
                <dl className="flex flex-wrap gap-x-6 gap-y-1.5 text-[13px]">
                  {[
                    ["Issued", prettyDate(invoice.issue_date)],
                    ["Due", prettyDate(invoice.due_date) || "On receipt"],
                    ["Lines", String(invoice.items?.length ?? 0)],
                    [
                      "Emailed",
                      invoice.sent_at
                        ? new Date(invoice.sent_at).toLocaleDateString("en-GB")
                        : "Not yet",
                    ],
                  ].map(([k, v]) => (
                    <div key={k} className="flex gap-1.5">
                      <dt className="font-semibold text-ink-300">{k}</dt>
                      <dd className="text-ink-700">{v}</dd>
                    </div>
                  ))}
                </dl>
                <InvoiceActions
                  id={invoice.id}
                  email={invoice.bill_to_email}
                  sent={Boolean(invoice.sent_at)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <Panel title="Raise a new invoice">
        <p className="mb-4 max-w-[70ch] text-[14px] leading-relaxed text-ink-400">
          For an invoice tied to a request, open the request and raise it there —
          it will carry the request reference. This one stands on its own.
        </p>
        <InvoiceBuilder />
      </Panel>
    </div>
  );
}
