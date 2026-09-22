import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, readSession } from "@/lib/admin-auth";
import { getSupabase } from "@/lib/supabase";
import { getInvoice } from "@/lib/admin-data";
import { makeReference, fieldErrors } from "@/lib/schemas";
import {
  computeTotals,
  formatMoney,
  invoiceDocument,
  invoiceFilename,
  invoiceInputSchema,
  invoiceMeta,
  invoiceText,
  itemsTable,
  prettyDate,
  round2,
  type InvoiceRow,
} from "@/lib/invoices";
import { layout } from "@/lib/email";
import { sendToCustomer, emailConfigured } from "@/lib/resend";

export const runtime = "nodejs";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://spendbox.site";

const noTable = (message: string) =>
  /invoices/.test(message) && /(does not exist|schema cache|relation)/i.test(message);

/**
 * The email the business receives.
 *
 * The invoice is both in the body — so it can be read on a phone without
 * opening anything — and attached as a document they can file or print.
 */
async function emailInvoice(invoice: InvoiceRow) {
  const document = invoiceDocument(invoice);

  const html = layout({
    preheader: `Invoice ${invoice.reference} — ${formatMoney(
      invoice.total,
      invoice.currency,
    )} due ${prettyDate(invoice.due_date) || "on receipt"}`,
    eyebrow: `Invoice · ${invoice.reference}`,
    heading: `${formatMoney(invoice.total, invoice.currency)} due`,
    intro: `Hello${
      invoice.bill_to_name ? ` ${invoice.bill_to_name.split(" ")[0]}` : ""
    }. Here is the invoice for ${invoice.bill_to_company}${
      invoice.request_reference ? `, against request ${invoice.request_reference}` : ""
    }.\n\nThe full invoice is attached as a document you can print or save. Reply to this email with any question about it.`,
    body: `${invoiceMeta(invoice)}${itemsTable(invoice)}${
      invoice.notes
        ? `<p style="margin:22px 0 0;font:400 14px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#5f736a;white-space:pre-line;">${invoice.notes
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")}</p>`
        : ""
    }`,
    cta: { label: "Visit Spendbox", href: siteUrl() },
    footnote: "Payment details are in the notes on the invoice, or just ask.",
  });

  return sendToCustomer({
    to: invoice.bill_to_email,
    subject: `Invoice ${invoice.reference} from Spendbox — ${formatMoney(
      invoice.total,
      invoice.currency,
    )}`,
    html,
    text: invoiceText(invoice),
    attachments: [
      {
        filename: invoiceFilename(invoice),
        content: Buffer.from(document, "utf8").toString("base64"),
      },
    ],
  });
}

/** Raises an invoice, and emails it straight away if asked to. */
export async function POST(request: Request) {
  const session = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  }

  const db = getSupabase();
  if (!db) {
    return NextResponse.json(
      { ok: false, message: "Supabase is not configured, so invoices cannot be saved." },
      { status: 503 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }

  const parsed = invoiceInputSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "Some of the invoice needs another look.",
        errors: fieldErrors(parsed.error),
      },
      { status: 422 },
    );
  }

  const input = parsed.data;
  const items = input.items.map((item) => ({
    description: item.description,
    quantity: round2(item.quantity),
    unitPrice: round2(item.unitPrice),
  }));
  const { subtotal, taxAmount, total } = computeTotals(items, input.taxRate, input.delivery);

  /* The request this is for, so the invoice can quote its reference. */
  let requestReference: string | null = null;
  if (input.requestId) {
    const { data } = await db
      .from("procurement_requests")
      .select("reference")
      .eq("id", input.requestId)
      .maybeSingle();
    requestReference = (data as { reference: string } | null)?.reference ?? null;
  }

  const row = {
    reference: makeReference("INV"),
    request_id: input.requestId || null,
    request_reference: requestReference,
    bill_to_company: input.billToCompany,
    bill_to_name: input.billToName || null,
    bill_to_email: input.billToEmail,
    bill_to_address: input.billToAddress || null,
    currency: input.currency,
    items,
    subtotal,
    tax_rate: input.taxRate,
    tax_amount: taxAmount,
    delivery: round2(input.delivery),
    total,
    issue_date: input.issueDate,
    due_date: input.dueDate || null,
    notes: input.notes || null,
    status: "draft",
  };

  const { data: created, error } = await db
    .from("invoices")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        message: noTable(error.message)
          ? "The invoices table is not in the database yet. Run supabase/schema.sql in the Supabase SQL editor, then try again."
          : error.message,
      },
      { status: 500 },
    );
  }

  const invoice = created as InvoiceRow;

  if (!input.send) {
    return NextResponse.json({
      ok: true,
      id: invoice.id,
      reference: invoice.reference,
      sent: false,
      message: `Invoice ${invoice.reference} saved. Download it, or send it when you are ready.`,
    });
  }

  if (!emailConfigured()) {
    return NextResponse.json({
      ok: true,
      id: invoice.id,
      reference: invoice.reference,
      sent: false,
      message: `Invoice ${invoice.reference} saved, but Resend is not configured so it could not be emailed.`,
    });
  }

  const result = await emailInvoice(invoice);
  if (result.ok) {
    await db
      .from("invoices")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", invoice.id);
  } else {
    console.error("[spendbox] invoice email FAILED", {
      reference: invoice.reference,
      to: invoice.bill_to_email,
      error: result.error,
    });
  }

  return NextResponse.json({
    ok: true,
    id: invoice.id,
    reference: invoice.reference,
    sent: result.ok,
    message: result.ok
      ? `Invoice ${invoice.reference} emailed to ${invoice.bill_to_email}.`
      : `Invoice ${invoice.reference} saved, but the email did not go out: ${result.error}`,
  });
}

/** Sends (or re-sends) an invoice that already exists. */
export async function PUT(request: Request) {
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

  let id = "";
  try {
    const body = (await request.json()) as Record<string, unknown>;
    id = String(body.id ?? "");
  } catch {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }

  if (!id) {
    return NextResponse.json({ ok: false, message: "Which invoice?" }, { status: 400 });
  }

  const invoice = await getInvoice(id);
  if (!invoice) {
    return NextResponse.json({ ok: false, message: "Invoice not found." }, { status: 404 });
  }

  if (!emailConfigured()) {
    return NextResponse.json(
      { ok: false, message: "Resend is not configured, so nothing can be sent." },
      { status: 503 },
    );
  }

  const result = await emailInvoice(invoice);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: `It did not go out: ${result.error}` },
      { status: 502 },
    );
  }

  await db
    .from("invoices")
    .update({
      status: invoice.status === "paid" ? "paid" : "sent",
      sent_at: new Date().toISOString(),
    })
    .eq("id", invoice.id);

  return NextResponse.json({
    ok: true,
    message: `Invoice ${invoice.reference} emailed to ${invoice.bill_to_email}.`,
  });
}
