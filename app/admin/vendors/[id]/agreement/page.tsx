import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-guard";
import { getSupabase } from "@/lib/supabase";
import { getDocument } from "@/lib/documents";
import { discountLabel } from "@/lib/discount";
import { agreementFields, agreementsFor } from "@/lib/agreements";
import type { VendorRow } from "@/lib/admin-data";
import { NeedsDatabase } from "../../../Empty";
import { Panel } from "../../../AdminUI";
import { AgreementActions, AgreementComposer } from "../../AgreementUI";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  sent: "border-amber-400/40 bg-amber-400/15 text-amber-500",
  signed: "border-forest-500 bg-forest-500 text-white",
  void: "border-bone-300 bg-bone-200 text-ink-400",
};
const STATUS_WORD: Record<string, string> = {
  sent: "waiting to be signed",
  signed: "signed",
  void: "void",
};

export default async function VendorAgreementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;

  const db = getSupabase();
  if (!db) return <NeedsDatabase detail="Supabase is not configured." />;

  const { data } = await db.from("vendor_applications").select("*").eq("id", id).maybeSingle();
  const vendor = data as VendorRow | null;
  if (!vendor) notFound();

  const [template, history] = await Promise.all([getDocument("vendor_mou"), agreementsFor(id)]);
  const termMonths = Number(template.meta.termMonths ?? 12) || 12;

  /* Everything but the numbers set on this page, which the form fills live. */
  const fields = agreementFields(vendor, {
    reference: "MOU-····-··· (given when sent)",
    startDate: new Date().toISOString().slice(0, 10),
    termMonths,
    discountMin: null,
    discountMax: null,
  });

  const signed = history.find((a) => a.status === "signed");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/vendors" className="text-[13.5px] font-bold text-ink-400 transition-colors hover:text-ink-900">
          ← Merchants
        </Link>
        <h1 className="mt-3 font-display text-[30px] font-bold tracking-[-0.025em] text-ink-900">
          Agreement with {vendor.company}
        </h1>
        <p className="mt-1 text-[14.5px] text-ink-400">
          {vendor.contact_name} · {vendor.email} · discount on record:{" "}
          <span className="font-semibold text-ink-700">
            {discountLabel(vendor.discount_min, vendor.discount_max)}
          </span>
          {signed && (
            <>
              {" · "}
              <span className="font-semibold text-forest-600">
                signed {new Date(signed.signed_at!).toLocaleDateString("en-GB")} by {signed.signer_name}
              </span>
            </>
          )}
        </p>
      </div>

      {history.length > 0 && (
        <Panel title="Sent so far">
          <ul className="flex flex-col gap-2.5">
            {history.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-bone-200 bg-bone-50 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[13px] font-bold text-ink-900">{a.reference}</span>
                    <span className={`rounded-full border px-2.5 py-0.5 text-[11.5px] font-bold uppercase tracking-wide ${STATUS_STYLE[a.status]}`}>
                      {STATUS_WORD[a.status]}
                    </span>
                  </p>
                  <p className="mt-1 text-[13px] text-ink-400">
                    {discountLabel(a.discount_min, a.discount_max)} · {a.term_months} months · sent{" "}
                    {a.sent_at ? new Date(a.sent_at).toLocaleDateString("en-GB") : "—"}
                    {a.created_by ? ` by ${a.created_by}` : ""}
                  </p>
                  {a.status === "signed" && (
                    <p className="mt-1 text-[13px] text-ink-600">
                      Signed by <span className="font-semibold">{a.signer_name}</span> ({a.signer_title}) on{" "}
                      {new Date(a.signed_at!).toLocaleString("en-GB", { timeZone: "Africa/Lagos" })}
                    </p>
                  )}
                </div>
                <AgreementActions id={a.id} status={a.status} />
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel
        title={history.length > 0 ? "Send a new agreement" : "Send the agreement"}
        action={
          <Link href="/admin/vendors/agreement-template" className="text-[13.5px] font-bold text-forest-500 hover:text-forest-600">
            Edit the template
          </Link>
        }
      >
        <p className="mb-5 max-w-[72ch] text-[14px] leading-relaxed text-ink-400">
          They get an email with a private link. They read it, type their name and title,
          tick to confirm — and a signed copy goes to them and to you. The exact words are
          fingerprinted when it is sent, so nobody can change what was signed.
        </p>
        <AgreementComposer
          vendorId={vendor.id}
          vendorEmail={vendor.email}
          template={{ title: template.title, body: template.body }}
          fields={fields}
          initialDiscount={{ min: vendor.discount_min ?? null, max: vendor.discount_max ?? null }}
          termMonths={termMonths}
        />
      </Panel>
    </div>
  );
}
