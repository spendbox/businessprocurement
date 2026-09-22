import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-guard";
import { DOCUMENT_FIELDS, defaultDocument, getDocument } from "@/lib/documents";
import { agreementFields } from "@/lib/agreements";
import { DocumentEditor } from "../../DocumentEditor";

export const dynamic = "force-dynamic";

export default async function AgreementTemplatePage() {
  await requireAdminPage();

  const doc = await getDocument("vendor_mou");
  const sample = agreementFields(
    {
      company: "Lekki Office Furniture Ltd",
      contact_name: "Tunde Bello",
      email: "tunde@lekkifurniture.ng",
      phone: "+234 803 000 0000",
      rc_number: "RC 1234567",
      categories: ["Office furniture", "Fixtures"],
      regions: ["Lagos", "Ogun"],
      fulfilment_speed: "2–5 working days",
      payment_terms: "Part payment, balance on delivery",
    },
    {
      reference: "MOU-4K2P-7QX",
      startDate: new Date().toISOString().slice(0, 10),
      termMonths: Number(doc.meta.termMonths ?? 12),
      discountMin: 5,
      discountMax: 12,
    },
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/vendors"
          className="text-[13.5px] font-bold text-ink-400 transition-colors hover:text-ink-900"
        >
          ← Merchants
        </Link>
        <h1 className="mt-3 font-display text-[30px] font-bold tracking-[-0.025em] text-ink-900">
          The merchant agreement
        </h1>
        <p className="mt-1 max-w-[72ch] text-[14.5px] leading-relaxed text-ink-400">
          The Memorandum of Understanding every merchant is sent to sign. Changing it
          here changes what is sent from now on — agreements already sent or signed
          keep exactly the words they had. Have a lawyer read your version before you
          rely on it.
        </p>
      </div>

      <DocumentEditor
        docKey="vendor_mou"
        initial={{ title: doc.title, body: doc.body, meta: doc.meta }}
        original={defaultDocument("vendor_mou")}
        isDefault={doc.isDefault}
        updatedAt={doc.updated_at}
        updatedBy={doc.updated_by}
        fields={DOCUMENT_FIELDS.vendor_mou}
        sample={sample}
        metaFields={[{ key: "termMonths", label: "Usual length", suffix: "months" }]}
      />
    </div>
  );
}
