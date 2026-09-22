import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-guard";
import {
  DOCUMENT_FIELDS,
  defaultDocument,
  getDocument,
  targetsFrom,
} from "@/lib/documents";
import { marketerFields, type MarketerVendor } from "@/lib/marketers";
import { DocumentEditor } from "../../DocumentEditor";

export const dynamic = "force-dynamic";

/** A believable marketer to fill the preview with. */
const SAMPLE_VENDORS: MarketerVendor[] = [
  {
    id: "a", company: "Lekki Office Furniture Ltd", reference: "VND-AAAA-111",
    contact_name: "Tunde Bello", email: "", phone: "", status: "approved",
    categories: ["Office furniture", "Fixtures"], regions: ["Lagos", "Ogun"],
    discount_min: 5, discount_max: 12, marketer_id: "x",
  },
  {
    id: "b", company: "Abuja Print & Stationery", reference: "VND-BBBB-222",
    contact_name: "Ngozi Okafor", email: "", phone: "", status: "approved",
    categories: ["Stationery", "Printing"], regions: ["FCT Abuja"],
    discount_min: 8, discount_max: 15, marketer_id: "x",
  },
];

export default async function PlaybookPage() {
  await requireAdminPage();

  const doc = await getDocument("marketer_playbook");
  const targets = targetsFrom(doc.meta);
  const today = new Date().toISOString().slice(0, 10);
  const day = 24 * 60 * 60 * 1000;
  const sample = marketerFields({ name: "Ada Obi" }, SAMPLE_VENDORS, {
    start: today,
    businessDeadline: new Date(Date.now() + (targets.businessWindowDays - 1) * day).toISOString().slice(0, 10),
    salesDeadline: new Date(Date.now() + (targets.salesWindowDays - 1) * day).toISOString().slice(0, 10),
    businesses: 12,
    sales: 2_450_000,
    businessesAllTime: 12,
    salesAllTime: 2_450_000,
  }, targets);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/marketers"
          className="text-[13.5px] font-bold text-ink-400 transition-colors hover:text-ink-900"
        >
          ← Marketers
        </Link>
        <h1 className="mt-3 font-display text-[30px] font-bold tracking-[-0.025em] text-ink-900">
          The marketer playbook
        </h1>
        <p className="mt-1 max-w-[72ch] text-[14.5px] leading-relaxed text-ink-400">
          What every marketer is sent. The targets below feed the progress bars on the
          Marketers page and every {"{{field}}"} in the text, so change a number here
          and it changes everywhere. Each marketer receives their own copy, with their
          name, their merchants and their dates filled in.
        </p>
      </div>

      <DocumentEditor
        docKey="marketer_playbook"
        initial={{ title: doc.title, body: doc.body, meta: doc.meta }}
        original={defaultDocument("marketer_playbook")}
        isDefault={doc.isDefault}
        updatedAt={doc.updated_at}
        updatedBy={doc.updated_by}
        fields={DOCUMENT_FIELDS.marketer_playbook}
        sample={sample}
        metaFields={[
          { key: "targetBusinesses", label: "Businesses to sign up", hint: "each marketer" },
          { key: "businessWindowDays", label: "…within", suffix: "days", hint: "of their start date" },
          { key: "targetSales", label: "Sales to reach", suffix: "₦", hint: "paid, in naira" },
          { key: "salesWindowDays", label: "…within", suffix: "days", hint: "of their start date" },
        ]}
      />
    </div>
  );
}
