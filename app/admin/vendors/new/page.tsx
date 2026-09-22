import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-guard";
import { listTeamQuietly } from "@/lib/team";
import { VendorEntry } from "../VendorEntry";

export const dynamic = "force-dynamic";

export default async function NewVendorPage() {
  await requireAdminPage();

  const team = await listTeamQuietly();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/vendors"
          className="text-[13.5px] font-bold text-ink-400 transition-colors hover:text-ink-900"
        >
          ← All merchants
        </Link>
        <h1 className="mt-3 font-display text-[30px] font-bold tracking-[-0.025em] text-ink-900">
          Add a merchant
        </h1>
        <p className="mt-1 max-w-[70ch] text-[14.5px] leading-relaxed text-ink-400">
          For a supplier you already know, or one who gave you their details
          over the phone. They go in exactly as an applicant would, so they are
          matched to requests the same way — and they are approved from the
          start unless you say otherwise.
        </p>
      </div>

      <VendorEntry
        team={team.filter((m) => m.role !== "marketer").map((m) => ({ id: m.id, name: m.name }))}
        marketers={team
          .filter((m) => m.role === "marketer" && m.active)
          .map((m) => ({ id: m.id, name: m.name }))}
      />
    </div>
  );
}
