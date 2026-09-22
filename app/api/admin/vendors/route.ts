import { NextResponse } from "next/server";
import { guardApi } from "@/lib/admin-guard";
import { deleteVendor } from "@/lib/admin-data";
import { getSupabase } from "@/lib/supabase";
import { fieldErrors, makeReference, manualVendorSchema } from "@/lib/schemas";
import { parseDiscount } from "@/lib/discount";
import { layout, rows, textVersion, type Row } from "@/lib/email";
import { sendToCustomer, emailConfigured } from "@/lib/resend";

export const runtime = "nodejs";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://spendbox.site";

/**
 * Adds a merchant by hand.
 *
 * For the supplier you already know — the one you have been buying from for
 * years, or the one who gave you their details over the phone. Same record as
 * an application, marked as entered by you rather than applied for, and
 * approved from the start unless you say otherwise.
 */
export async function POST(request: Request) {
  const guard = await guardApi("admin");
  if (!guard.ok) return guard.response;

  const db = getSupabase();
  if (!db) {
    return NextResponse.json(
      {
        ok: false,
        message: "Supabase is not configured, so there is nowhere to save a merchant.",
      },
      { status: 503 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }

  const parsed = manualVendorSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "Some of those details need another look.",
        errors: fieldErrors(parsed.error),
      },
      { status: 422 },
    );
  }

  const vendor = parsed.data;
  const reference = makeReference("VND");

  const discount = parseDiscount(vendor.discountMin, vendor.discountMax);
  if (!discount.ok) {
    return NextResponse.json(
      { ok: false, message: discount.message, errors: { discountMin: discount.message } },
      { status: 422 },
    );
  }

  const { data, error } = await db
    .from("vendor_applications")
    .insert({
      reference,
      company: vendor.company,
      rc_number: vendor.rcNumber || null,
      website: vendor.website || null,
      years_trading: vendor.yearsTrading,
      categories: vendor.categories,
      supply_description: vendor.supplyDescription,
      moq: vendor.moq || null,
      monthly_capacity: vendor.monthlyCapacity || null,
      fulfilment_speed: vendor.fulfilmentSpeed,
      regions: vendor.regions,
      own_logistics: Boolean(vendor.ownLogistics),
      payment_terms: vendor.paymentTerms,
      contact_name: vendor.contactName,
      role: vendor.role || null,
      email: vendor.email,
      phone: vendor.phone,
      notes: vendor.notes || null,
      status: vendor.status,
      internal_notes: vendor.internalNotes || null,
      assigned_to: vendor.assignedTo || null,
      marketer_id: vendor.marketerId || null,
      discount_min: discount.min,
      discount_max: discount.max,
      added_by_admin: true,
    })
    .select("id,company,reference")
    .single();

  if (error) {
    /* A database that has not had the migration run is the likely cause. */
    const missingColumn = /assigned_to|added_by_admin|marketer_id|discount_/.test(error.message);
    return NextResponse.json(
      {
        ok: false,
        message: missingColumn
          ? "Run supabase/schema.sql in the Supabase SQL editor first — this needs the newest columns."
          : error.message,
      },
      { status: 500 },
    );
  }

  const created = data as { id: string; company: string; reference: string };

  /* ---------------- optional welcome email ---------------- */
  let emailed: boolean | undefined;
  let emailError: string | undefined;

  if (vendor.sendWelcome && vendor.status === "approved") {
    if (!emailConfigured()) {
      emailError = "Resend is not configured, so no email was sent.";
    } else {
      const detailRows: Row[] = [
        { label: "Company", value: vendor.company },
        { label: "You supply", value: vendor.categories.join(", ") },
        { label: "You deliver to", value: vendor.regions.join(", ") },
        { label: "Fulfilment speed", value: vendor.fulfilmentSpeed },
        { label: "Payment terms", value: vendor.paymentTerms },
      ];

      const result = await sendToCustomer({
        to: vendor.email,
        subject: `Spendbox: ${vendor.company} is set up as a merchant (${reference})`,
        html: layout({
          preheader: `${vendor.company} is on Spendbox — requests that match what you supply start coming through now.`,
          eyebrow: "Merchant approved",
          heading: "You are set up to supply",
          intro: `Hello ${vendor.contactName.split(" ")[0]} — we have set ${
            vendor.company
          } up on Spendbox with the details below.\n\nFrom now on you will get emails from us with real purchase requests that match what you supply. Reply with your price, your lead time and what the price includes, and quote the reference.`,
          reference,
          body: rows(detailRows),
          cta: { label: "Visit Spendbox", href: siteUrl() },
          footnote:
            "Anything wrong or missing above? Just reply to this email and we will correct your record.",
        }),
        text: textVersion("You are set up to supply", reference, detailRows),
      });
      emailed = result.ok;
      if (!result.ok) emailError = result.error;
    }
  }

  return NextResponse.json({
    ok: true,
    id: created.id,
    reference: created.reference,
    emailed,
    message: emailError
      ? `${created.company} added as ${created.reference}, but the email did not go out: ${emailError}`
      : emailed
        ? `${created.company} added as ${created.reference} and emailed.`
        : `${created.company} added as ${created.reference}.`,
  });
}

/**
 * Changes one thing about a merchant: who on the team looks after them, or
 * the discount range they have agreed. Only the fields sent are touched.
 */
export async function PATCH(request: Request) {
  const guard = await guardApi("admin");
  if (!guard.ok) return guard.response;

  const db = getSupabase();
  if (!db) {
    return NextResponse.json(
      { ok: false, message: "Supabase is not configured." },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }

  const id = String(body.id ?? "");
  if (!id) {
    return NextResponse.json({ ok: false, message: "Which merchant?" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if ("assignedTo" in body) {
    const value = body.assignedTo;
    patch.assigned_to = typeof value === "string" && value ? value : null;
  }
  if ("discountMin" in body || "discountMax" in body) {
    const discount = parseDiscount(body.discountMin, body.discountMax);
    if (!discount.ok) {
      return NextResponse.json({ ok: false, message: discount.message }, { status: 422 });
    }
    patch.discount_min = discount.min;
    patch.discount_max = discount.max;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, message: "Nothing to change." }, { status: 400 });
  }

  const { error } = await db.from("vendor_applications").update(patch).eq("id", id);

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        message: /assigned_to|discount_/.test(error.message)
          ? "Run supabase/schema.sql in the Supabase SQL editor first — this needs the newest columns."
          : error.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    message:
      "discount_min" in patch
        ? "Discount saved."
        : patch.assigned_to
          ? "Assigned."
          : "Left unassigned.",
  });
}

/**
 * Removes a merchant for good.
 *
 * Behind the admin session, and the UI asks for a second click before it
 * calls this, because there is no undo — a deleted application is gone from
 * the database and from every future match.
 */
export async function DELETE(request: Request) {
  const guard = await guardApi("admin");
  if (!guard.ok) return guard.response;

  let id = "";
  try {
    const body = (await request.json()) as Record<string, unknown>;
    id = String(body.id ?? "");
  } catch {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }

  if (!id) {
    return NextResponse.json(
      { ok: false, message: "Which merchant?" },
      { status: 400 },
    );
  }

  const result = await deleteVendor(id);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: result.error ?? "Could not delete that merchant." },
      { status: 500 },
    );
  }

  console.log("[spendbox] merchant deleted", { id, company: result.company });

  return NextResponse.json({
    ok: true,
    message: `${result.company ?? "Merchant"} deleted.`,
  });
}
