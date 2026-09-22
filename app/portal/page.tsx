import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { PORTAL_COOKIE, readPortalSession } from "@/lib/portal-auth";
import { BUYER_STATUS, VENDOR_STATUS, getPortalData } from "@/lib/portal-data";
import { DataUnavailable } from "@/lib/admin-data";
import { URGENCIES, urgencyLabel } from "@/lib/catalog";
import { LogoMark } from "@/components/Logo";
import { NewRequest, PortalShell, RequestCard, SignOut } from "./PortalUI";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your requests",
  robots: { index: false, follow: false },
};

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const urgencyShort = (value: string) =>
  URGENCIES.find((u) => u.value === value)?.label ?? value;

export default async function PortalPage() {
  const session = await readPortalSession((await cookies()).get(PORTAL_COOKIE)?.value);
  if (!session) redirect("/portal/login");

  let data;
  try {
    data = await getPortalData(session.email);
  } catch (error) {
    if (error instanceof DataUnavailable) {
      return (
        <main className="mx-auto max-w-[640px] px-5 py-16">
          <p className="rounded-2xl border-[1.5px] border-amber-400/40 bg-amber-400/8 p-6 text-[15px] leading-relaxed text-ink-700">
            {error.message}
          </p>
        </main>
      );
    }
    throw error;
  }

  const { requests, vendor } = data;
  const latest = requests[0];
  const company = latest?.company ?? vendor?.company ?? "";
  const contactName = latest?.contact_name ?? vendor?.contact_name ?? "";
  const open = requests.filter((r) => ["new", "sourcing", "quoted"].includes(r.status));

  return (
    <PortalShell>
      <div className="min-h-[100svh] bg-bone-100 pb-24">
        <header className="sticky top-0 z-30 border-b border-bone-200 bg-bone-100/90 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-[680px] items-center justify-between gap-3 px-4 sm:px-6">
            <Link href="/" className="flex shrink-0 items-center gap-2">
              <LogoMark className="h-7 w-7" />
              <span className="font-display text-[17px] font-extrabold tracking-[-0.03em] text-ink-900">
                Spendbox
              </span>
            </Link>
            <SignOut />
          </div>
        </header>

        <main className="mx-auto max-w-[680px] px-4 py-7 sm:px-6 sm:py-10">
          <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.025em] text-ink-900">
            {company ? company : "Your requests"}
          </h1>
          <p className="mt-1.5 text-[14.5px] text-ink-400">
            Signed in as {session.email}
            {open.length > 0 && ` · ${open.length} open`}
          </p>

          <div className="mt-6">
            <NewRequest company={company} contactName={contactName} email={session.email} full />
          </div>

          {vendor && (
            <section className="mt-8">
              <h2 className="mb-3 text-[13px] font-bold uppercase tracking-[0.08em] text-ink-500">
                Your merchant application
              </h2>
              <div className="rounded-2xl border border-bone-200 bg-white p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-bone-200 px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-wide text-ink-700">
                    {VENDOR_STATUS[vendor.status]?.label ?? vendor.status}
                  </span>
                  <span className="font-mono text-[12px] text-ink-300">{vendor.reference}</span>
                </div>
                <p className="mt-3 text-[14.5px] leading-relaxed text-ink-600">
                  {VENDOR_STATUS[vendor.status]?.detail ?? ""}
                </p>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-bone-200 pt-4">
                  {[
                    ["Supplies", vendor.categories.join(", ")],
                    ["Delivers to", vendor.regions.join(", ")],
                    ["Speed", vendor.fulfilment_speed],
                    ["Applied", when(vendor.created_at)],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-300">
                        {k}
                      </dt>
                      <dd className="mt-0.5 text-[13.5px] font-semibold text-ink-800">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </section>
          )}

          <section className="mt-8">
            <h2 className="mb-3 text-[13px] font-bold uppercase tracking-[0.08em] text-ink-500">
              {requests.length > 0
                ? `Requests (${requests.length})`
                : "Requests"}
            </h2>

            {requests.length === 0 ? (
              <p className="rounded-2xl border border-bone-200 bg-white px-5 py-8 text-center text-[14.5px] leading-relaxed text-ink-400">
                Nothing here yet. Your requests will appear as soon as you send
                one.
              </p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {requests.map((r) => {
                  const status = BUYER_STATUS[r.status] ?? {
                    label: r.status,
                    detail: "",
                    step: 0,
                  };
                  return (
                    <RequestCard
                      key={r.id}
                      reference={r.reference}
                      need={r.need}
                      createdAt={when(r.created_at)}
                      statusLabel={status.label}
                      statusDetail={status.detail}
                      step={status.step}
                      urgency={urgencyShort(r.urgency)}
                      details={[
                        { label: "Categories", value: r.categories.join(", ") },
                        { label: "Quantity", value: r.quantity ?? "—" },
                        { label: "How soon", value: urgencyLabel(r.urgency) },
                        {
                          label: "Deliver to",
                          value: [r.address, r.city, r.region, r.country]
                            .filter(Boolean)
                            .join(", "),
                        },
                        { label: "Budget", value: r.budget ?? "—" },
                      ].filter((d) => d.value && d.value !== "—")}
                    />
                  );
                })}
              </ul>
            )}
          </section>

          <p className="mt-8 text-center text-[13px] leading-relaxed text-ink-400">
            Anything to change on a request? Reply to its confirmation email and
            we will pick it up.
          </p>
        </main>
      </div>
    </PortalShell>
  );
}
