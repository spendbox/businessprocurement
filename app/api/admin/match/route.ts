import { NextResponse } from "next/server";
import { guardApi } from "@/lib/admin-guard";
import { getRequest, rankedVendors, type VendorRow } from "@/lib/admin-data";
import { getSupabase } from "@/lib/supabase";
import { urgencyLabel } from "@/lib/catalog";
import { layout, rows, textVersion, type Row } from "@/lib/email";
import { sendToCustomer, emailConfigured } from "@/lib/resend";

export const runtime = "nodejs";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://spendbox.site";

/**
 * Sends a request out to merchants for quoting.
 *
 * Deliberately shows the merchant what they need to price — the item, the
 * quantity, where it goes and by when — and withholds the buyer's identity
 * and contact details. Quotes come back to us, not straight to the buyer.
 */
export async function POST(request: Request) {
  const guard = await guardApi("signed-in");
  if (!guard.ok) return guard.response;

  if (!emailConfigured()) {
    return NextResponse.json(
      { ok: false, message: "Resend is not configured, so nothing can be sent." },
      { status: 503 },
    );
  }

  let requestId = "";
  let vendorIds: string[] = [];
  let note = "";
  try {
    const body = (await request.json()) as Record<string, unknown>;
    requestId = String(body.requestId ?? "");
    if (Array.isArray(body.vendorIds)) {
      vendorIds = body.vendorIds.filter((v): v is string => typeof v === "string");
    }
    if (typeof body.note === "string") note = body.note.slice(0, 1200);
  } catch {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }

  if (!requestId || vendorIds.length === 0) {
    return NextResponse.json(
      { ok: false, message: "Pick at least one merchant." },
      { status: 400 },
    );
  }

  const procurement = await getRequest(requestId);
  if (!procurement) {
    return NextResponse.json({ ok: false, message: "Request not found." }, { status: 404 });
  }

  /*
   * Any approved merchant the admin picked is fair game — they can see the
   * score and the gaps and may still have a reason to ask. The guard that
   * matters is that the merchant is approved, which rankedVendors enforces.
   */
  const eligible = await rankedVendors(procurement);
  const recipients = eligible.filter((v) => vendorIds.includes(v.id));

  if (recipients.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "None of those merchants are approved any more. Refresh and pick again.",
      },
      { status: 422 },
    );
  }

  const destination = [procurement.city, procurement.region, procurement.country]
    .filter(Boolean)
    .join(", ");

  const briefRows: Row[] = [
    { label: "What is needed", value: procurement.need },
    { label: "Categories", value: procurement.categories.join(", ") },
    { label: "Quantity / spec", value: procurement.quantity },
    { label: "Needed by", value: urgencyLabel(procurement.urgency) },
    {
      label: "Hard deadline",
      value: procurement.has_deadline ? procurement.needed_by : "None given",
    },
    { label: "Deliver to", value: destination },
    { label: "Budget band", value: procurement.budget },
    {
      label: "Recurring",
      value: procurement.recurring ? "Yes — ongoing supply" : "One-off",
    },
    { label: "Note from us", value: note },
  ];

  const results = await Promise.all(
    recipients.map(async (vendor: VendorRow) => {
      const html = layout({
        preheader: `Quote wanted: ${procurement.categories.join(", ")} for ${destination}`,
        eyebrow: `Quote wanted · ${procurement.reference}`,
        heading: "A buyer needs this — what is your price?",
        intro: `Hello ${vendor.contact_name.split(" ")[0]}. This came in for ${destination} and matches what ${vendor.company} supplies.\n\nReply to this email with your price, lead time and what the price includes. Quote the reference so we can match it up.`,
        reference: procurement.reference,
        body: rows(briefRows),
        cta: { label: "Visit Spendbox", href: siteUrl() },
        footnote:
          "Buyer details stay with us until an offer is accepted. If this is not one for you, no reply is needed.",
      });

      const result = await sendToCustomer({
        to: vendor.email,
        subject: `Quote wanted: ${procurement.categories.slice(0, 2).join(", ")} · ${procurement.reference}`,
        html,
        text: textVersion("Quote wanted", procurement.reference, briefRows),
      });

      return { vendor: vendor.company, email: vendor.email, ...result };
    }),
  );

  const sent = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  // Sending is the point at which a request stops being "new".
  if (sent.length > 0 && procurement.status === "new") {
    const db = getSupabase();
    await db?.from("procurement_requests").update({ status: "sourcing" }).eq("id", requestId);
  }

  return NextResponse.json({
    ok: sent.length > 0,
    sent: sent.length,
    failed: failed.map((f) => ({ email: f.email, error: f.error })),
    message:
      failed.length === 0
        ? `Sent to ${sent.length} merchant${sent.length === 1 ? "" : "s"}.`
        : `Sent to ${sent.length}, but ${failed.length} failed.`,
  });
}
