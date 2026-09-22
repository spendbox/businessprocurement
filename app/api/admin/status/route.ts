import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, readSession } from "@/lib/admin-auth";
import { getSupabase } from "@/lib/supabase";
import { REQUEST_STATUSES, VENDOR_STATUSES, type VendorRow } from "@/lib/admin-data";
import { INVOICE_STATUSES } from "@/lib/invoices";
import { layout, rows, textVersion, type Row } from "@/lib/email";
import { sendToCustomer, emailConfigured } from "@/lib/resend";

export const runtime = "nodejs";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://spendbox.site";

/**
 * The letter a merchant gets when they are approved.
 *
 * Sent the moment the status changes rather than left for someone to write
 * by hand, because the gap between "approved" in our dashboard and the
 * merchant knowing about it is the gap where they go quiet.
 */
async function sendApprovalEmail(vendor: VendorRow) {
  const detailRows: Row[] = [
    { label: "Company", value: vendor.company },
    { label: "You supply", value: (vendor.categories ?? []).join(", ") },
    { label: "You deliver to", value: (vendor.regions ?? []).join(", ") },
    { label: "Fulfilment speed", value: vendor.fulfilment_speed },
    { label: "Payment terms", value: vendor.payment_terms },
  ];

  const html = layout({
    preheader: `${vendor.company} is approved — requests that match what you supply start coming through now.`,
    eyebrow: "Merchant approved",
    heading: "You are approved to supply",
    intro: `Good news ${vendor.contact_name.split(" ")[0]} — ${
      vendor.company
    } has been approved on Spendbox.\n\nFrom now on you will get emails from us with real purchase requests that match what you supply. Reply with your price, your lead time and what the price includes, and quote the reference. The buyer picks from the offers we put in front of them.`,
    reference: vendor.reference,
    body: rows(detailRows),
    cta: { label: "Visit Spendbox", href: siteUrl() },
    footnote:
      "Anything to change — categories, delivery areas, a different contact? Just reply to this email and we will update your record.",
  });

  return sendToCustomer({
    to: vendor.email,
    subject: `Spendbox: ${vendor.company} is approved (${vendor.reference})`,
    html,
    text: textVersion("You are approved to supply", vendor.reference, detailRows),
  });
}

/** Moves a request, a merchant or an invoice along your workflow. */
export async function POST(request: Request) {
  const session = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  }

  const db = getSupabase();
  if (!db) {
    return NextResponse.json(
      { ok: false, message: "Supabase is not configured." },
      { status: 503 },
    );
  }

  let kind = "";
  let id = "";
  let status = "";
  let internalNotes: string | undefined;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    kind = String(body.kind ?? "");
    id = String(body.id ?? "");
    status = String(body.status ?? "");
    if (typeof body.internalNotes === "string") internalNotes = body.internalNotes;
  } catch {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }

  const table =
    kind === "request"
      ? "procurement_requests"
      : kind === "vendor"
        ? "vendor_applications"
        : kind === "invoice"
          ? "invoices"
          : null;
  if (!table || !id) {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }

  const allowed: readonly string[] =
    kind === "request"
      ? REQUEST_STATUSES
      : kind === "vendor"
        ? VENDOR_STATUSES
        : INVOICE_STATUSES;

  const patch: Record<string, unknown> = {};
  if (status) {
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { ok: false, message: "That is not a status we use." },
        { status: 422 },
      );
    }
    patch.status = status;
  }
  if (internalNotes !== undefined) {
    if (kind === "invoice") {
      return NextResponse.json(
        { ok: false, message: "Invoices do not carry internal notes." },
        { status: 400 },
      );
    }
    patch.internal_notes = internalNotes.slice(0, 4000) || null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, message: "Nothing to change." }, { status: 400 });
  }

  /*
   * The row as it stands, read before the change: an approval email must
   * only go out on the move INTO approved, and the merchant's details are
   * needed to write it.
   */
  let before: Record<string, unknown> | null = null;
  if (status && kind === "vendor") {
    const { data } = await db.from(table).select("*").eq("id", id).maybeSingle();
    before = (data as Record<string, unknown>) ?? null;
  }

  /*
   * Cancelling files a request away; putting it back on any other status
   * takes it out of the archive again. The archive is a place, not a
   * deletion — everything stays readable.
   */
  let archiveApplied = false;
  if (kind === "request" && status) {
    patch.archived_at = status === "cancelled" ? new Date().toISOString() : null;
    archiveApplied = true;
  }

  if (kind === "invoice" && status === "paid") {
    patch.paid_at = new Date().toISOString();
  }

  let { error } = await db.from(table).update(patch).eq("id", id);

  /* A database without the archiving migration still saves the status. */
  if (error && archiveApplied && /archived_at/.test(error.message)) {
    delete patch.archived_at;
    archiveApplied = false;
    ({ error } = await db.from(table).update(patch).eq("id", id));
  }

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  /* ---------------- approval email ---------------- */
  let emailed: boolean | undefined;
  let emailError: string | undefined;

  const previous = before;
  const becameApproved =
    kind === "vendor" &&
    status === "approved" &&
    previous !== null &&
    previous.status !== "approved";

  if (becameApproved && previous) {
    if (!emailConfigured()) {
      emailError = "Resend is not configured, so no email was sent.";
    } else {
      const result = await sendApprovalEmail(previous as unknown as VendorRow);
      emailed = result.ok;
      if (!result.ok) {
        emailError = result.error;
        console.error("[spendbox] approval email FAILED", {
          vendor: previous.reference,
          to: previous.email,
          error: result.error,
        });
      } else {
        console.log("[spendbox] approval email sent", {
          vendor: previous.reference,
          to: previous.email,
        });
      }
    }
  }

  const archived = kind === "request" && archiveApplied && status === "cancelled";

  return NextResponse.json({
    ok: true,
    archived,
    emailed,
    message: emailed
      ? `Approved — ${String(previous?.company ?? "the merchant")} has been emailed.`
      : emailError
        ? `Status saved, but the approval email did not go out: ${emailError}`
        : archived
          ? "Cancelled and moved to the archive."
          : undefined,
  });
}
