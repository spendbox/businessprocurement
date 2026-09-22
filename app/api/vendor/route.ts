import { NextResponse } from "next/server";
import { vendorSchema, makeReference, fieldErrors } from "@/lib/schemas";
import { layout, rows, textVersion, type Row } from "@/lib/email";
import { sendInternal, sendToCustomer, emailConfigured } from "@/lib/resend";
import { saveRow, dbConfigured } from "@/lib/supabase";
import { rateLimit, clientKey } from "@/lib/ratelimit";

export const runtime = "nodejs";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://spendbox.site";

export async function POST(request: Request) {
  const limit = rateLimit(`vendor:${clientKey(request)}`);
  if (!limit.ok) {
    return NextResponse.json(
      {
        ok: false,
        message: `You have sent a few applications already. Try again in ${Math.ceil(
          limit.retryAfter / 60,
        )} minutes.`,
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "We could not read that application." },
      { status: 400 },
    );
  }

  const parsed = vendorSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "Some details need another look.",
        errors: fieldErrors(parsed.error),
      },
      { status: 422 },
    );
  }

  const vendor = parsed.data;

  /*
   * The bot trap is a FLAG, not a bin.
   *
   * It used to return a fake success and drop the submission, which meant a
   * browser autofilling the hidden field made a real request vanish with no
   * email, no database row and no log line anywhere. Losing one genuine
   * order costs far more than processing one spam one, so a hit is now
   * recorded, shouted about in the log, and marked in the internal email.
   */
  const flagged = Boolean(vendor.honeypot);
  if (flagged) {
    console.warn("[spendbox] bot trap tripped — processing anyway", {
      kind: "vendor",
      company: vendor.company,
      email: vendor.email,
      value: vendor.honeypot?.slice(0, 40),
    });
  }

  const reference = makeReference("VND");
  const submittedAt = new Date();

  const detailRows: Row[] = [
    { label: "Company", value: vendor.company },
    { label: "RC number", value: vendor.rcNumber },
    { label: "Website", value: vendor.website },
    { label: "Years trading", value: vendor.yearsTrading },
    { label: "Supplies", value: vendor.categories.join(", ") },
    { label: "What they supply", value: vendor.supplyDescription },
    { label: "Minimum order", value: vendor.moq },
    { label: "Monthly capacity", value: vendor.monthlyCapacity },
    { label: "Fulfilment speed", value: vendor.fulfilmentSpeed },
    { label: "Delivers to", value: vendor.regions.join(", ") },
    { label: "Own logistics", value: vendor.ownLogistics ? "Yes" : "No" },
    { label: "Payment terms", value: vendor.paymentTerms },
    {
      label: "Contact",
      value: `${vendor.contactName}${vendor.role ? ` (${vendor.role})` : ""} · ${
        vendor.email
      } · ${vendor.phone}`,
    },
    { label: "Notes", value: vendor.notes },
    { label: "Submitted", value: submittedAt.toUTCString() },
  ];

  let dbError: string | undefined;
  if (dbConfigured()) {
    const saved = await saveRow("vendor_applications", {
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
    });
    if (!saved.ok) dbError = saved.error;
  }

  if (!emailConfigured()) {
    console.error("[vendor] RESEND_API_KEY missing — application not delivered", {
      reference,
      company: vendor.company,
      email: vendor.email,
    });
    return NextResponse.json(
      {
        ok: false,
        message:
          "Email is not set up on this deployment yet, so we could not confirm your application. Please contact us directly.",
      },
      { status: 500 },
    );
  }

  const internalHtml = layout({
    preheader: `${vendor.company} wants to supply ${vendor.categories.join(", ")}`,
    eyebrow: "New merchant application",
    heading: `${vendor.company} wants to supply`,
    intro: `They cover ${vendor.regions.join(", ")} and can fulfil in ${
      vendor.fulfilmentSpeed
    }.\nReply to this email to reach ${vendor.contactName} directly.`,
    reference,
    body: rows(detailRows),
    footnote: dbError
      ? `Note: this application was NOT saved to the database (${dbError}). The details above are the only copy.`
      : undefined,
  });

  const vendorRows: Row[] = [
    { label: "Company", value: vendor.company },
    { label: "Categories you supply", value: vendor.categories.join(", ") },
    { label: "Where you deliver", value: vendor.regions.join(", ") },
    { label: "Fulfilment speed", value: vendor.fulfilmentSpeed },
    { label: "Payment terms", value: vendor.paymentTerms },
    { label: "Contact", value: `${vendor.email} · ${vendor.phone}` },
  ];

  const vendorHtml = layout({
    preheader: `Application ${reference} received — we review merchants within 2 working days.`,
    eyebrow: "Application received",
    heading: "You are on the list",
    intro: `Thanks ${vendor.contactName.split(" ")[0]}. We review new merchants within two working days.\n\nOnce you are approved we start sending you real purchase requests that match what you supply — you reply with your best offer, and the buyer picks.`,
    reference,
    body: rows(vendorRows),
    cta: { label: "Visit Spendbox", href: siteUrl() },
    footnote: "Anything to add or correct? Just reply to this email.",
  });

  const [internalResult, vendorResult] = await Promise.all([
    sendInternal({
      subject: `${flagged ? "[?spam] " : ""}[Merchant] ${
        vendor.company
      } · ${vendor.categories.slice(0, 2).join(", ")} · ${reference}`,
      html: internalHtml,
      text: textVersion("New merchant application", reference, detailRows),
      replyTo: vendor.email,
    }),
    sendToCustomer({
      to: vendor.email,
      subject: `Spendbox: your merchant application (${reference})`,
      html: vendorHtml,
      text: textVersion("Your merchant application", reference, vendorRows),
    }),
  ]);

  const savedToDb = dbConfigured() && !dbError;

  if (!internalResult.ok) {
    console.error("[spendbox] internal merchant email FAILED", {
      reference,
      error: internalResult.error,
      from: process.env.EMAIL_FROM ?? "(EMAIL_FROM unset)",
      to: process.env.EMAIL_TO_INTERNAL ?? "(EMAIL_TO_INTERNAL unset)",
    });
  }
  if (!vendorResult.ok) {
    console.error("[spendbox] merchant confirmation FAILED", {
      reference,
      to: vendor.email,
      error: vendorResult.error,
      from: process.env.EMAIL_FROM ?? "(EMAIL_FROM unset)",
    });
  }
  if (internalResult.ok && vendorResult.ok) {
    console.log("[spendbox] merchant application delivered", {
      reference,
      company: vendor.company,
    });
  }

  if (!internalResult.ok && !savedToDb) {
    console.error("[spendbox] application LOST — nothing stored, nothing sent", {
      reference,
      company: vendor.company,
      email: vendor.email,
      emailError: internalResult.error,
      dbError,
    });
    return NextResponse.json(
      {
        ok: false,
        message:
          "We could not record your application just now. Please email us directly and we will pick it up.",
        detail: internalResult.error,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    reference,
    confirmationSent: vendorResult.ok,
    confirmationError: vendorResult.ok ? undefined : vendorResult.error,
  });
}
