import { NextResponse } from "next/server";
import { orderSchema, makeReference, fieldErrors } from "@/lib/schemas";
import { urgencyLabel, URGENCIES } from "@/lib/catalog";
import { acceptable, humanSize } from "@/lib/attachments";
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

  /*
   * The bot trap is a FLAG, not a bin — a browser autofilling a hidden
   * field must never make a real request disappear.
   */
  const flagged = Boolean(order.honeypot);
  if (flagged) {
    console.warn("[spendbox] bot trap tripped — processing anyway", {
      kind: "order",
      company: order.company,
      email: order.email,
    });
  }

  const reference = makeReference("SPB");
  const urgency = URGENCIES.find((u) => u.value === order.urgency);
  const submittedAt = new Date();

  /* Files ride along on the internal email so the team opens the real thing. */
  const { keep: files, rejected } = acceptable(order.attachments ?? []);
  if (rejected.length > 0) {
    console.warn("[spendbox] attachments dropped", { reference, rejected });
  }

  const destination = [order.address, order.city, order.region, order.country]
    .filter(Boolean)
    .join(", ");

  const fileLine =
    files.length > 0
      ? files.map((f) => `${f.name} (${humanSize(f.size)})`).join("\n")
      : "";

  const detailRows: Row[] = [
    { label: "What they wrote", value: order.need },
    { label: "Categories", value: (order.categories ?? []).join(", ") },
    { label: "Quantity", value: order.quantity },
    { label: "How soon", value: urgencyLabel(order.urgency) },
    { label: "Hard deadline", value: order.neededBy },
    { label: "Deliver to", value: destination },
    { label: "Budget", value: order.budget },
    { label: "Recurring need", value: order.recurring ? "Yes" : "" },
    { label: "Attached", value: fileLine },
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
      categories: order.categories ?? [],
      quantity: order.quantity || null,
      has_attachment: files.length > 0,
      attachment_note:
        files.length > 0 ? files.map((f) => f.name).join(", ") : null,
      urgency: order.urgency,
      has_deadline: Boolean(order.neededBy),
      needed_by: order.neededBy || null,
      country: order.country,
      city: order.city || null,
      region: order.region,
      address: order.address || null,
      company: order.company,
      contact_name: order.contactName,
      email: order.email,
      phone: order.phone,
      budget: order.budget || null,
      recurring: Boolean(order.recurring),
      notes: null,
    });
    if (!saved.ok) dbError = saved.error;
  }

  if (!emailConfigured()) {
    console.error("[spendbox] RESEND_API_KEY missing — request not delivered", {
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

  const internalHtml = layout({
    preheader: `${order.company} — ${order.need.slice(0, 90)}`,
    eyebrow: `New request · ${urgency?.label ?? order.urgency}`,
    heading: `${order.company} needs sourcing`,
    intro: `Priority: ${urgencyLabel(order.urgency)}.\nReply to this email to reach ${
      order.contactName
    } directly.${files.length > 0 ? `\n\n${files.length} file${files.length === 1 ? "" : "s"} attached.` : ""}`,
    reference,
    body: rows(detailRows),
    footnote: [
      dbError
        ? `Note: this request was NOT saved to the database (${dbError}). The details above are the only copy.`
        : "",
      rejected.length > 0
        ? `The buyer tried to attach: ${rejected.map((r) => `${r.name} — ${r.why}`).join("; ")}.`
        : "",
    ]
      .filter(Boolean)
      .join("\n") || undefined,
  });

  const customerRows: Row[] = [
    { label: "What you asked for", value: order.need },
    { label: "How soon you need it", value: urgencyLabel(order.urgency) },
    { label: "Delivering to", value: destination },
    { label: "Attached", value: fileLine },
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
    intro: `Thanks ${order.contactName.split(" ")[0]}. ${promise}\n\nNothing else is needed from you right now — keep this email for your reference.`,
    reference,
    body: rows(customerRows),
    cta: { label: "Send another request", href: siteUrl() },
    footnote: "Something to change? Just reply to this email.",
  });

  /* Resend takes attachments as base64 under the same name the buyer used. */
  const resendAttachments = files.map((f) => ({
    filename: f.name,
    content: f.data,
  }));

  const [internalResult, customerResult] = await Promise.all([
    sendInternal({
      subject: `${flagged ? "[?spam] " : ""}[${
        urgency?.label ?? "New"
      }] ${order.company} · ${(order.categories ?? []).slice(0, 2).join(", ") || "Uncategorised"} · ${reference}`,
      html: internalHtml,
      text: textVersion("New procurement request", reference, detailRows),
      replyTo: order.email,
      attachments: resendAttachments,
    }),
    sendToCustomer({
      to: order.email,
      subject: `Spendbox: we have your request (${reference})`,
      html: customerHtml,
      text: textVersion("We have your request", reference, customerRows),
    }),
  ]);

  const savedToDb = dbConfigured() && !dbError;

  if (!internalResult.ok) {
    console.error("[spendbox] internal email FAILED", {
      reference,
      error: internalResult.error,
      from: process.env.EMAIL_FROM ?? "(EMAIL_FROM unset)",
      to: process.env.EMAIL_TO_INTERNAL ?? "(EMAIL_TO_INTERNAL unset)",
    });
  }
  if (!customerResult.ok) {
    console.error("[spendbox] confirmation email FAILED", {
      reference,
      to: order.email,
      error: customerResult.error,
    });
  }
  if (internalResult.ok && customerResult.ok) {
    console.log("[spendbox] request delivered", {
      reference,
      company: order.company,
      files: files.length,
    });
  }

  if (!internalResult.ok && !savedToDb) {
    console.error("[spendbox] request LOST — nothing stored, nothing sent", {
      reference,
      company: order.company,
      email: order.email,
      emailError: internalResult.error,
      dbError,
    });
    return NextResponse.json(
      {
        ok: false,
        message:
          "We could not record your request just now. Nothing has been lost on your side — please email us directly and we will pick it up.",
        detail: internalResult.error,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    reference,
    confirmationSent: customerResult.ok,
    urgency: order.urgency,
    attachmentsRejected: rejected,
  });
}
