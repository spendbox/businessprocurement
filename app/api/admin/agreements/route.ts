import { NextResponse } from "next/server";
import { guardApi } from "@/lib/admin-guard";
import { displayName } from "@/lib/admin-auth";
import { getSupabase } from "@/lib/supabase";
import { fieldErrors, makeReference } from "@/lib/schemas";
import { parseDiscount } from "@/lib/discount";
import { fillFields, fieldsIn } from "@/lib/doc-render";
import { sendToCustomer, emailConfigured } from "@/lib/resend";
import type { VendorRow } from "@/lib/admin-data";
import {
  agreementFields,
  fingerprint,
  getAgreement,
  missingAgreementsTable,
  requestSignatureEmail,
  sendAgreementSchema,
  signingLink,
  type AgreementRow,
} from "@/lib/agreements";

export const runtime = "nodejs";

const tableHint = (message: string) =>
  missingAgreementsTable(message)
    ? "The vendor_agreements table is not in the database yet. Run supabase/schema.sql in the Supabase SQL editor, then try again."
    : message;

async function emailSigningLink(agreement: AgreementRow) {
  const link = await signingLink(agreement.id);
  if (!link) return { ok: false, error: "ADMIN_SESSION_SECRET is not set, so no signing link can be made." };
  const email = requestSignatureEmail(agreement, link);
  return sendToCustomer({ to: agreement.vendor_email, ...email });
}

/**
 * Fills the agreement in for one merchant, freezes it, and emails them a
 * private link to sign it.
 */
export async function POST(request: Request) {
  const guard = await guardApi("admin");
  if (!guard.ok) return guard.response;

  const db = getSupabase();
  if (!db) {
    return NextResponse.json({ ok: false, message: "Supabase is not configured." }, { status: 503 });
  }
  if (!emailConfigured()) {
    return NextResponse.json(
      { ok: false, message: "Resend is not configured, so the agreement cannot be emailed." },
      { status: 503 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }

  const parsed = sendAgreementSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "The agreement needs another look.", errors: fieldErrors(parsed.error) },
      { status: 422 },
    );
  }
  const input = parsed.data;

  const discount = parseDiscount(input.discountMin, input.discountMax);
  if (!discount.ok) {
    return NextResponse.json({ ok: false, message: discount.message }, { status: 422 });
  }
  if (discount.min === null && discount.max === null) {
    return NextResponse.json(
      { ok: false, message: "Agree a discount range before sending the agreement." },
      { status: 422 },
    );
  }

  const { data: vendorData } = await db
    .from("vendor_applications")
    .select("*")
    .eq("id", input.vendorId)
    .maybeSingle();
  const vendor = vendorData as VendorRow | null;
  if (!vendor) {
    return NextResponse.json({ ok: false, message: "Merchant not found." }, { status: 404 });
  }

  const reference = makeReference("MOU");
  const fields = agreementFields(vendor, {
    reference,
    startDate: input.startDate,
    termMonths: input.termMonths,
    discountMin: discount.min,
    discountMax: discount.max,
  });
  const title = fillFields(input.title, fields);
  const body = fillFields(input.body, fields);

  /* A field nobody could fill would reach the merchant as {{braces}}. */
  const left = [...fieldsIn(title), ...fieldsIn(body)];
  if (left.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        message: `These fields are not ones the agreement knows: ${[...new Set(left)]
          .map((f) => `{{${f}}}`)
          .join(", ")}. Fix or remove them first.`,
      },
      { status: 422 },
    );
  }

  const frozen = {
    reference,
    vendor_id: vendor.id,
    vendor_company: vendor.company,
    vendor_contact: vendor.contact_name,
    vendor_email: vendor.email,
    title,
    body,
    discount_min: discount.min,
    discount_max: discount.max,
    term_months: input.termMonths,
  };

  const { data: created, error } = await db
    .from("vendor_agreements")
    .insert({
      ...frozen,
      document_hash: await fingerprint(frozen),
      status: "sent",
      sent_at: new Date().toISOString(),
      created_by: displayName(guard.session),
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, message: tableHint(error.message) }, { status: 500 });
  }

  const agreement = created as AgreementRow;

  if (input.saveDiscount) {
    await db
      .from("vendor_applications")
      .update({ discount_min: discount.min, discount_max: discount.max })
      .eq("id", vendor.id);
  }

  const result = await emailSigningLink(agreement);
  if (!result.ok) {
    console.error("[spendbox] agreement email FAILED", {
      reference,
      to: vendor.email,
      error: result.error,
    });
    return NextResponse.json({
      ok: true,
      id: agreement.id,
      message: `${reference} is saved, but the email did not go out: ${result.error}. Use "Send the link again" once that is fixed.`,
    });
  }

  return NextResponse.json({
    ok: true,
    id: agreement.id,
    message: `${reference} sent to ${vendor.email} to sign.`,
  });
}

/** Sends a fresh signing link for an agreement still waiting. */
export async function PUT(request: Request) {
  const guard = await guardApi("admin");
  if (!guard.ok) return guard.response;

  let id = "";
  try {
    id = String(((await request.json()) as Record<string, unknown>).id ?? "");
  } catch {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }

  const agreement = await getAgreement(id);
  if (!agreement) {
    return NextResponse.json({ ok: false, message: "Agreement not found." }, { status: 404 });
  }
  if (agreement.status !== "sent") {
    return NextResponse.json(
      { ok: false, message: `That agreement is ${agreement.status}, so there is nothing to sign.` },
      { status: 409 },
    );
  }
  if (!emailConfigured()) {
    return NextResponse.json({ ok: false, message: "Resend is not configured." }, { status: 503 });
  }

  const result = await emailSigningLink(agreement);
  return NextResponse.json(
    {
      ok: result.ok,
      message: result.ok
        ? `A fresh link went to ${agreement.vendor_email}.`
        : `It did not go out: ${result.error}`,
    },
    { status: result.ok ? 200 : 502 },
  );
}

/**
 * Voids an agreement. Every link to it stops working at once, because a
 * link only signs an agreement that is still waiting.
 */
export async function PATCH(request: Request) {
  const guard = await guardApi("admin");
  if (!guard.ok) return guard.response;

  const db = getSupabase();
  if (!db) {
    return NextResponse.json({ ok: false, message: "Supabase is not configured." }, { status: 503 });
  }

  let id = "";
  try {
    id = String(((await request.json()) as Record<string, unknown>).id ?? "");
  } catch {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }

  const { data, error } = await db
    .from("vendor_agreements")
    .update({ status: "void", voided_at: new Date().toISOString() })
    .eq("id", id)
    .neq("status", "void")
    .select("reference,status")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, message: tableHint(error.message) }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, message: "That agreement is already void." }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    message: `${(data as { reference: string }).reference} is void. Its signing link no longer works.`,
  });
}
