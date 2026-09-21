import { NextResponse } from "next/server";
import { orderSchema, makeReference, fieldErrors } from "@/lib/schemas";
import { ATTACHMENT_TIMING, urgencyLabel, URGENCIES } from "@/lib/catalog";
import { layout, rows, textVersion, type Row } from "@/lib/email";
import { sendInternal, sendToCustomer, emailConfigured } from "@/lib/resend";
import { saveRow, dbConfigured } from "@/lib/supabase";
import { rateLimit, clientKey } from "@/lib/ratelimit";

export const runtime = "nodejs";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://spendbox.site";

export async function POST(request: Request) {
  const limit = rateLimit(`order:${clientKey(request)}`);
  if (!limit.ok) {
    return NextResponse.json(
      {
        ok: false,
        message: `You have sent a few requests already. Try again in ${Math.ceil(
          limit.retryAfter / 60,
        )} minutes, or email us directly.`,
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "We could not read that request." },
      { status: 400 },
    );
  }

  const parsed = orderSchema.safeParse(payload);
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

  const order = parsed.data;

  // Honeypot filled means a bot. Answer as if it worked and drop it.
  if (order.honeypot) {
    return NextResponse.json({ ok: true, reference: makeReference("SPB") });
  }

  const reference = makeReference("SPB");
  const urgency = URGENCIES.find((u) => u.value === order.urgency);
  const submittedAt = new Date();

  const timingLabel =
    ATTACHMENT_TIMING.find((t) => t.value === order.attachmentTiming)?.label ?? "";

  const attachmentSummary = order.hasAttachment
    ? [
        `Yes — ${timingLabel || "timing not given"}`,
        order.attachmentNote ? `(${order.attachmentNote})` : "",
      ]
        .filter(Boolean)
        .join(" ")
    : "No — working from the description alone";

  const destination = [order.address, order.city, order.region, order.country]
    .filter(Boolean)
    .join(", ");

  const detailRows: Row[] = [
    { label: "What they need", value: order.need },
    { label: "Categories", value: order.categories.join(", ") },
    { label: "Quantity / spec", value: order.quantity },
    { label: "How soon", value: urgencyLabel(order.urgency) },
    {
      label: "Hard deadline",
      value: order.hasDeadline ? order.neededBy : "None given",
    },
    { label: "Deliver to", value: destination },
    { label: "Budget", value: order.budget },
    { label: "Recurring need", value: order.recurring ? "Yes" : "" },
    { label: "Purchase order / spreadsheet", value: attachmentSummary },
    { label: "Extra notes", value: order.notes },
    { label: "Business", value: order.company },
    { label: "Contact", value: `${order.contactName} · ${order.email} · ${order.phone}` },
    { label: "Submitted", value: submittedAt.toUTCString() },
  ];

  /* ---------------- persistence (optional) ---------------- */
  let dbError: string | undefined;
  if (dbConfigured()) {
    const saved = await saveRow("procurement_requests", {
      reference,
      need: order.need,
      categories: order.categories,
      quantity: order.quantity || null,
      has_attachment: Boolean(order.hasAttachment),
      attachment_timing: order.attachmentTiming || null,
      attachment_note: order.attachmentNote || null,
      urgency: order.urgency,
      has_deadline: Boolean(order.hasDeadline),
      needed_by: order.neededBy || null,
      country: order.country,
      city: order.city,
      region: order.region,
      address: order.address || null,
      company: order.company,
      contact_name: order.contactName,
      email: order.email,
      phone: order.phone,
      budget: order.budget || null,
      recurring: Boolean(order.recurring),
      notes: order.notes || null,
    });
    if (!saved.ok) dbError = saved.error;
  }

  /* ---------------- emails ---------------- */
  const internalHtml = layout({
    preheader: `${order.company} needs ${order.categories.join(", ")} — ${
      urgency?.label ?? order.urgency
    }`,
    eyebrow: `New request · ${urgency?.label ?? order.urgency}`,
    heading: `${order.company} needs sourcing`,
    intro: `Priority: ${urgencyLabel(order.urgency)}.\nReply to this email to reach ${
      order.contactName
    } directly.`,
    reference,
    body: rows(detailRows),
    footnote: dbError
      ? `Note: this request was NOT saved to the database (${dbError}). The details above are the only copy.`
      : undefined,
  });

  const customerRows: Row[] = [
    { label: "What you asked for", value: order.need },
    { label: "Categories", value: order.categories.join(", ") },
    { label: "Quantity / spec", value: order.quantity },
    { label: "How soon you need it", value: urgencyLabel(order.urgency) },
    { label: "Needed by", value: order.hasDeadline ? order.neededBy : "" },
    { label: "Delivering to", value: destination },
    {
      label: "Purchase order",
      value: order.hasAttachment ? attachmentSummary : "",
    },
    { label: "Budget you shared", value: order.budget },
    { label: "Your notes", value: order.notes },
  ];

  const promise =
    order.urgency === "same-day"
      ? "Because this is marked as needed today, someone will call you within the hour."
      : order.urgency === "48-hours"
        ? "Because this is urgent, we will come back with offers today."
        : "We will come back with the best offers within 24 hours.";

  const customerHtml = layout({
    preheader: `Request ${reference} received — ${promise}`,
    eyebrow: "Request received",
    heading: "We have your request",
    intro: `Thanks ${order.contactName.split(" ")[0]}. ${promise}\n\n${
      order.hasAttachment && order.attachmentTiming === "now"
        ? "You said you have a purchase order ready — reply to this email with the file attached and we will quote against it line by line."
        : "Nothing else is needed from you right now — keep this email for your reference."
    }`,
    reference,
    body: rows(customerRows),
    cta: { label: "Send another request", href: siteUrl() },
    footnote: "Something to change? Just reply to this email.",
  });

  // If email is not configured at all, say so plainly rather than
  // pretending the request went somewhere.
  if (!emailConfigured()) {
    console.error("[order] RESEND_API_KEY missing — request not delivered", {
      reference,
      company: order.company,
      email: order.email,
    });
    return NextResponse.json(
      {
        ok: false,
        message:
          "Email is not set up on this deployment yet, so we could not confirm your request. Please contact us directly.",
      },
      { status: 500 },
    );
  }

  const [internalResult, customerResult] = await Promise.all([
    sendInternal({
      subject: `[${urgency?.label ?? "New"}] ${order.company} · ${order.categories
        .slice(0, 2)
        .join(", ")} · ${reference}`,
      html: internalHtml,
      text: textVersion("New procurement request", reference, detailRows),
      replyTo: order.email,
    }),
    sendToCustomer({
      to: order.email,
      subject: `Spendbox: we have your request (${reference})`,
      html: customerHtml,
      text: textVersion("We have your request", reference, customerRows),
    }),
  ]);

  if (!internalResult.ok) {
    console.error("[order] internal email failed", reference, internalResult.error);
  }
  if (!customerResult.ok) {
    console.error("[order] customer email failed", reference, customerResult.error);
  }

  return NextResponse.json({
    ok: true,
    reference,
    confirmationSent: customerResult.ok,
    urgency: order.urgency,
  });
}
