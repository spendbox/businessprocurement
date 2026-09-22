import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DataUnavailable,
  REQUEST_STATUSES,
  getRequest,
  rankedVendors,
} from "@/lib/admin-data";
import { ATTACHMENT_TIMING, urgencyLabel, URGENCIES } from "@/lib/catalog";
import {
  InternalNotes,
  Panel,
  SendToMerchants,
  StatusSelect,
  UrgencyChip,
} from "../../AdminUI";
import { NeedsDatabase } from "../../Empty";

export const dynamic = "force-dynamic";

const urgencyLabelFor = (value: string) =>
  URGENCIES.find((u) => u.value === value)?.label ?? value;

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value || !value.trim()) return null;
  return (
    <div className="border-b border-bone-200 py-3 last:border-0">
      <dt className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-300">
        {label}
      </dt>
      <dd className="mt-1 whitespace-pre-line text-[14.5px] leading-relaxed text-ink-800">
        {value}
      </dd>
    </div>
  );
}

export default async function RequestDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let request;
  let vendors;
  try {
    request = await getRequest(id);
    if (!request) notFound();
    vendors = await rankedVendors(request);
  } catch (error) {
    if (error instanceof DataUnavailable) return <NeedsDatabase detail={error.message} />;
    throw error;
  }

  const attachment =
    request.has_attachment === true
      ? `Yes — ${
          ATTACHMENT_TIMING.find((t) => t.value === request.attachment_timing)?.label ??
          "timing not given"
        }${request.attachment_note ? ` (${request.attachment_note})` : ""}`
      : request.has_attachment === false
        ? "No — description only"
        : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/requests"
          className="text-[13.5px] font-bold text-ink-400 transition-colors hover:text-ink-900"
        >
          ← All requests
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.025em] text-ink-900">
              {request.company}
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-[13px] text-ink-400">
                {request.reference}
              </span>
              <UrgencyChip
                urgency={request.urgency}
                label={urgencyLabelFor(request.urgency)}
              />
            </p>
          </div>
          <StatusSelect
            kind="request"
            id={request.id}
            value={request.status}
            options={REQUEST_STATUSES}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div className="flex flex-col gap-6">
          <Panel title="The request">
            <dl>
              <Field label="What they need" value={request.need} />
              <Field label="Categories" value={request.categories.join(", ")} />
              <Field label="Quantity / spec" value={request.quantity} />
              <Field label="Purchase order" value={attachment} />
              <Field label="How soon" value={urgencyLabel(request.urgency)} />
              <Field
                label="Hard deadline"
                value={request.has_deadline ? request.needed_by : "None given"}
              />
              <Field
                label="Deliver to"
                value={[request.address, request.city, request.region, request.country]
                  .filter(Boolean)
                  .join(", ")}
              />
              <Field label="Budget" value={request.budget} />
              <Field
                label="Recurring"
                value={request.recurring ? "Yes — ongoing supply" : "One-off"}
              />
              <Field label="Their notes" value={request.notes} />
            </dl>
          </Panel>

          <Panel title="Send to merchants for quoting">
            <SendToMerchants
              requestId={request.id}
              vendors={vendors.map((v) => ({
                id: v.id,
                company: v.company,
                email: v.email,
                contact_name: v.contact_name,
                categories: v.categories,
                regions: v.regions,
                fulfilment_speed: v.fulfilment_speed,
                score: v.score,
                reasons: v.reasons,
                gaps: v.gaps,
                recommended: v.recommended,
              }))}
            />
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Who to reply to">
            <dl>
              <Field label="Contact" value={request.contact_name} />
              <Field label="Email" value={request.email} />
              <Field label="Phone" value={request.phone} />
              <Field
                label="Received"
                value={new Date(request.created_at).toLocaleString("en-GB")}
              />
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={`mailto:${request.email}?subject=${encodeURIComponent(
                  `Your Spendbox request ${request.reference}`,
                )}`}
                className="inline-flex min-h-[44px] items-center rounded-full bg-ink-900 px-4 text-[14px] font-bold text-bone-50 transition-colors hover:bg-ink-800"
              >
                Email the buyer
              </a>
              <a
                href={`tel:${request.phone.replace(/\s/g, "")}`}
                className="inline-flex min-h-[44px] items-center rounded-full border-[1.5px] border-bone-300 px-4 text-[14px] font-bold text-ink-800 transition-colors hover:border-ink-900"
              >
                Call
              </a>
            </div>
          </Panel>

          <Panel title="Internal notes">
            <InternalNotes id={request.id} value={request.internal_notes ?? ""} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
