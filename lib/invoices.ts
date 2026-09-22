import { z } from "zod";
import { escapeHtml } from "./email";

/**
 * Invoices raised from the dashboard.
 *
 * One invoice is a frozen document: the lines, the rates and the totals are
 * stored as they were on the day it went out, because a buyer's copy and
 * ours have to agree months later. Nothing here recalculates a saved
 * invoice — totals are worked out once, on the way in, and kept.
 */

export const CURRENCIES = [
  { code: "NGN", symbol: "₦", label: "Naira (₦)" },
  { code: "USD", symbol: "$", label: "US dollar ($)" },
  { code: "GBP", symbol: "£", label: "Pound (£)" },
  { code: "EUR", symbol: "€", label: "Euro (€)" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

export const INVOICE_STATUSES = ["draft", "sent", "paid", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export type InvoiceItem = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export type InvoiceRow = {
  id: string;
  created_at: string;
  reference: string;
  request_id: string | null;
  request_reference: string | null;
  bill_to_company: string;
  bill_to_name: string | null;
  bill_to_email: string;
  bill_to_address: string | null;
  currency: string;
  items: InvoiceItem[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  delivery: number;
  total: number;
  issue_date: string;
  due_date: string | null;
  notes: string | null;
  status: string;
  sent_at: string | null;
  paid_at: string | null;
};

/* ------------------------------------------------------------------ */
/* Money                                                               */
/* ------------------------------------------------------------------ */

/** Two decimal places, always, so nothing drifts by a kobo. */
export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export const symbolFor = (code: string): string =>
  CURRENCIES.find((c) => c.code === code)?.symbol ?? "";

export function formatMoney(amount: number, currency: string): string {
  const value = round2(Number.isFinite(amount) ? amount : 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const symbol = symbolFor(currency);
  return symbol ? `${symbol}${value}` : `${value} ${currency}`;
}

export type Totals = { subtotal: number; taxAmount: number; total: number };

export function computeTotals(
  items: InvoiceItem[],
  taxRate: number,
  delivery: number,
): Totals {
  const subtotal = round2(
    items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
  );
  const taxAmount = round2((subtotal * (taxRate || 0)) / 100);
  const total = round2(subtotal + taxAmount + (delivery || 0));
  return { subtotal, taxAmount, total };
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

const money = z.coerce.number().min(0, "Cannot be negative").max(1_000_000_000);

export const invoiceItemSchema = z.object({
  description: z.string().trim().min(1, "Describe the line").max(300),
  quantity: z.coerce.number().min(0.01, "Quantity must be more than zero").max(1_000_000),
  unitPrice: money,
});

export const invoiceInputSchema = z.object({
  requestId: z.string().uuid().optional().or(z.literal("")),
  billToCompany: z.string().trim().min(1, "Who is this invoice for?").max(160),
  billToName: z.string().trim().max(120).optional().or(z.literal("")),
  billToEmail: z.string().trim().toLowerCase().email("A valid email is needed to send it"),
  billToAddress: z.string().trim().max(400).optional().or(z.literal("")),
  currency: z.enum(CURRENCIES.map((c) => c.code) as [string, ...string[]]),
  items: z.array(invoiceItemSchema).min(1, "Add at least one line").max(40),
  taxRate: z.coerce.number().min(0).max(100),
  delivery: money,
  issueDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker"),
  dueDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker")
    .optional()
    .or(z.literal("")),
  notes: z.string().trim().max(1500).optional().or(z.literal("")),
  /** Email it to the business now, or just save it. */
  send: z.boolean().optional().default(false),
});

export type InvoiceInput = z.infer<typeof invoiceInputSchema>;

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

const INK = "#12211b";
const MUTED = "#5f736a";
const LINE = "#e4e2d8";
const FOREST = "#0f7a52";
const BONE = "#f5f4ed";

export const prettyDate = (value: string | null | undefined): string => {
  if (!value) return "";
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

/** The lines and the totals, as a table that survives email clients. */
export function itemsTable(invoice: InvoiceRow): string {
  const lines = invoice.items
    .map(
      (item) => `<tr>
  <td style="padding:11px 0;border-bottom:1px solid ${LINE};font:400 15px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK};">${escapeHtml(
        item.description,
      )}</td>
  <td align="right" style="padding:11px 0 11px 12px;border-bottom:1px solid ${LINE};white-space:nowrap;font:400 15px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${MUTED};">${escapeHtml(
        String(item.quantity),
      )}</td>
  <td align="right" style="padding:11px 0 11px 12px;border-bottom:1px solid ${LINE};white-space:nowrap;font:400 15px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${MUTED};">${escapeHtml(
        formatMoney(item.unitPrice, invoice.currency),
      )}</td>
  <td align="right" style="padding:11px 0 11px 12px;border-bottom:1px solid ${LINE};white-space:nowrap;font:600 15px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK};">${escapeHtml(
        formatMoney(item.quantity * item.unitPrice, invoice.currency),
      )}</td>
</tr>`,
    )
    .join("");

  const totalLine = (label: string, value: string, strong = false) => `<tr>
  <td colspan="2"></td>
  <td align="right" style="padding:${strong ? "14px" : "8px"} 0 ${
    strong ? "14px" : "8px"
  } 12px;font:${strong ? "700 15px" : "400 14px"}/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${
    strong ? INK : MUTED
  };${strong ? `border-top:2px solid ${INK};` : ""}">${escapeHtml(label)}</td>
  <td align="right" style="padding:${strong ? "14px" : "8px"} 0 ${
    strong ? "14px" : "8px"
  } 12px;white-space:nowrap;font:${
    strong ? "700 19px" : "400 14px"
  }/1.4 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK};${
    strong ? `border-top:2px solid ${INK};` : ""
  }">${escapeHtml(value)}</td>
</tr>`;

  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:6px 0 4px;">
<tr>
  <th align="left" style="padding:0 0 8px;border-bottom:2px solid ${INK};font:700 11px/1.4 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:${MUTED};">Description</th>
  <th align="right" style="padding:0 0 8px 12px;border-bottom:2px solid ${INK};font:700 11px/1.4 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:${MUTED};">Qty</th>
  <th align="right" style="padding:0 0 8px 12px;border-bottom:2px solid ${INK};font:700 11px/1.4 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:${MUTED};">Unit</th>
  <th align="right" style="padding:0 0 8px 12px;border-bottom:2px solid ${INK};font:700 11px/1.4 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:${MUTED};">Amount</th>
</tr>
${lines}
${totalLine("Subtotal", formatMoney(invoice.subtotal, invoice.currency))}
${
  Number(invoice.tax_rate) > 0
    ? totalLine(
        `VAT (${Number(invoice.tax_rate)}%)`,
        formatMoney(invoice.tax_amount, invoice.currency),
      )
    : ""
}
${
  Number(invoice.delivery) > 0
    ? totalLine("Delivery", formatMoney(invoice.delivery, invoice.currency))
    : ""
}
${totalLine("Total due", formatMoney(invoice.total, invoice.currency), true)}
</table>`;
}

/** The short summary block that sits above the lines. */
export function invoiceMeta(invoice: InvoiceRow): string {
  const cell = (label: string, value: string) =>
    value
      ? `<td valign="top" style="padding:0 16px 0 0;">
  <div style="font:700 11px/1.4 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:${MUTED};">${escapeHtml(
    label,
  )}</div>
  <div style="margin-top:3px;font:600 15px/1.45 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK};">${escapeHtml(
    value,
  )}</div>
</td>`
      : "";

  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px;background:${BONE};border:1px solid ${LINE};border-radius:14px;">
<tr><td style="padding:16px 18px;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
    ${cell("Invoice", invoice.reference)}
    ${cell("Issued", prettyDate(invoice.issue_date))}
    ${cell("Due", prettyDate(invoice.due_date) || "On receipt")}
    ${cell("Request", invoice.request_reference ?? "")}
  </tr></table>
</td></tr>
</table>`;
}

/**
 * A standalone invoice document.
 *
 * Deliberately a self-contained HTML file rather than a generated PDF: it
 * opens in any browser, prints to one page, and "Save as PDF" in the print
 * dialog produces exactly the same document. No binary dependency, nothing
 * to keep in step with a template engine.
 */
export function invoiceDocument(
  invoice: InvoiceRow,
  options: { business?: string; showPrintButton?: boolean } = {},
): string {
  const business = options.business ?? "Spendbox";
  const billTo = [
    invoice.bill_to_company,
    invoice.bill_to_name,
    invoice.bill_to_email,
    invoice.bill_to_address,
  ]
    .filter((v) => v && String(v).trim())
    .map((v) => escapeHtml(v))
    .join("<br>");

  const printButton = options.showPrintButton
    ? `<div class="no-print" style="margin:0 0 22px;">
  <button type="button" onclick="window.print()" style="cursor:pointer;border:0;border-radius:999px;background:${FOREST};color:#fff;padding:13px 22px;font:700 15px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">Print or save as PDF</button>
  <span style="margin-left:12px;font:400 13px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${MUTED};">Choose “Save as PDF” as the destination.</span>
</div>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invoice ${escapeHtml(invoice.reference)}</title>
<style>
  @page { margin: 16mm; }
  body { margin:0; background:#eceae0; }
  @media print { body { background:#fff; } .no-print { display:none !important; } .sheet { border:0 !important; box-shadow:none !important; margin:0 !important; } }
</style>
</head>
<body>
<div style="max-width:720px;margin:0 auto;padding:28px 16px 48px;">
${printButton}
<div class="sheet" style="background:#fff;border:1px solid ${LINE};border-radius:18px;padding:34px 30px;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px;">
    <tr>
      <td valign="top">
        <div style="font:800 21px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK};letter-spacing:-.02em;">${escapeHtml(
          business,
        )}</div>
        <div style="margin-top:4px;font:500 13px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${MUTED};">business procurement</div>
      </td>
      <td valign="top" align="right">
        <div style="font:700 11px/1.4 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;letter-spacing:.09em;text-transform:uppercase;color:${FOREST};">Invoice</div>
        <div style="margin-top:4px;font:700 20px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:${INK};letter-spacing:.04em;">${escapeHtml(
          invoice.reference,
        )}</div>
        <div style="margin-top:6px;font:600 12px/1.4 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:${
          invoice.status === "paid" ? FOREST : MUTED
        };">${escapeHtml(invoice.status)}</div>
      </td>
    </tr>
  </table>

  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px;">
    <tr><td valign="top">
      <div style="font:700 11px/1.4 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:${MUTED};">Billed to</div>
      <div style="margin-top:5px;font:400 15px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK};">${billTo}</div>
    </td></tr>
  </table>

  ${invoiceMeta(invoice)}
  ${itemsTable(invoice)}

  ${
    invoice.notes
      ? `<div style="margin-top:24px;padding-top:16px;border-top:1px solid ${LINE};">
  <div style="font:700 11px/1.4 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:${MUTED};">Notes</div>
  <div style="margin-top:5px;font:400 14px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK};white-space:pre-line;">${escapeHtml(
    invoice.notes,
  )}</div>
</div>`
      : ""
  }

  <div style="margin-top:26px;font:400 12.5px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${MUTED};">
    ${escapeHtml(business)} &middot; business procurement, handled by people.<br>
    Questions about this invoice? Reply to the email it came with.
  </div>
</div>
</div>
</body>
</html>`;
}

/** Plain-text version, for the email and for anyone reading on a watch. */
export function invoiceText(invoice: InvoiceRow): string {
  const lines = [
    `Invoice ${invoice.reference}`,
    "=".repeat(`Invoice ${invoice.reference}`.length),
    "",
    `Billed to: ${invoice.bill_to_company}`,
    `Issued: ${prettyDate(invoice.issue_date)}`,
    `Due: ${prettyDate(invoice.due_date) || "On receipt"}`,
  ];
  if (invoice.request_reference) lines.push(`Request: ${invoice.request_reference}`);
  lines.push("");
  for (const item of invoice.items) {
    lines.push(
      `${item.description} — ${item.quantity} × ${formatMoney(
        item.unitPrice,
        invoice.currency,
      )} = ${formatMoney(item.quantity * item.unitPrice, invoice.currency)}`,
    );
  }
  lines.push("", `Subtotal: ${formatMoney(invoice.subtotal, invoice.currency)}`);
  if (Number(invoice.tax_rate) > 0) {
    lines.push(
      `VAT (${Number(invoice.tax_rate)}%): ${formatMoney(invoice.tax_amount, invoice.currency)}`,
    );
  }
  if (Number(invoice.delivery) > 0) {
    lines.push(`Delivery: ${formatMoney(invoice.delivery, invoice.currency)}`);
  }
  lines.push(`TOTAL DUE: ${formatMoney(invoice.total, invoice.currency)}`);
  if (invoice.notes) lines.push("", invoice.notes);
  lines.push("", "— Spendbox");
  return lines.join("\n");
}

/** Safe for a Content-Disposition filename and for a downloads folder. */
export const invoiceFilename = (invoice: InvoiceRow): string =>
  `invoice-${invoice.reference.replace(/[^A-Za-z0-9-]/g, "")}.html`;
