import { z } from "zod";
import { getSupabase } from "./supabase";
import { sign, verify } from "./signing";
import { discountLabel } from "./discount";
import { escapeText, fillFields, plainDoc, renderDoc, smallPrint } from "./doc-render";
import { layout } from "./email";
import type { VendorRow } from "./admin-data";

/**
 * Merchant agreements, signed electronically.
 *
 * An agreement is frozen the moment it is sent: the exact words the merchant
 * will read, the discount and the term, plus a SHA-256 fingerprint of all of
 * it. The merchant gets a private link by email. Signing means typing their
 * full name and title and ticking a clear consent box, and the record keeps
 * who, when, from which address and on which browser — and checks the
 * fingerprint again, so the words that were signed are provably the words
 * that were sent.
 */

export const AGREEMENT_STATUSES = ["sent", "signed", "void"] as const;
export type AgreementStatus = (typeof AGREEMENT_STATUSES)[number];

export type AgreementRow = {
  id: string;
  created_at: string;
  reference: string;
  vendor_id: string | null;
  vendor_company: string;
  vendor_contact: string;
  vendor_email: string;
  title: string;
  body: string;
  discount_min: number | null;
  discount_max: number | null;
  term_months: number | null;
  document_hash: string;
  status: AgreementStatus;
  sent_at: string | null;
  created_by: string | null;
  signed_at: string | null;
  signer_name: string | null;
  signer_title: string | null;
  signer_ip: string | null;
  signer_agent: string | null;
  voided_at: string | null;
};

const LINK_DAYS = 30;

export const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://spendbox.site";

/* ------------------------------------------------------------------ */
/* Filling the template                                                */
/* ------------------------------------------------------------------ */

const prettyDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

const pctText = (n: number | null) =>
  n === null ? "an agreed" : String(Number.isInteger(n) ? n : Number(n.toFixed(2)));

/** Every {{field}} the agreement template understands, for one merchant. */
export function agreementFields(
  vendor: Pick<
    VendorRow,
    | "company"
    | "contact_name"
    | "email"
    | "phone"
    | "rc_number"
    | "categories"
    | "regions"
    | "fulfilment_speed"
    | "payment_terms"
  >,
  terms: {
    reference: string;
    startDate: string;
    termMonths: number;
    discountMin: number | null;
    discountMax: number | null;
  },
): Record<string, string> {
  return {
    our_company: "Spendbox",
    reference: terms.reference,
    start_date: prettyDate(terms.startDate),
    vendor_company: vendor.company,
    vendor_contact: vendor.contact_name,
    vendor_email: vendor.email,
    vendor_phone: vendor.phone,
    vendor_rc: vendor.rc_number?.trim() || "not provided",
    categories: (vendor.categories ?? []).join(", "),
    regions: (vendor.regions ?? []).join(", "),
    fulfilment_speed: vendor.fulfilment_speed.toLowerCase(),
    payment_terms: vendor.payment_terms,
    discount_min: pctText(terms.discountMin ?? terms.discountMax),
    discount_max: pctText(terms.discountMax ?? terms.discountMin),
    term_months: String(terms.termMonths),
  };
}

/* ------------------------------------------------------------------ */
/* The fingerprint                                                     */
/* ------------------------------------------------------------------ */

/**
 * What is signed. Every word and number the merchant agrees to goes in; the
 * signature details do not, since they are added afterwards.
 */
export async function fingerprint(a: {
  reference: string;
  vendor_company: string;
  vendor_contact: string;
  vendor_email: string;
  title: string;
  body: string;
  discount_min: number | null;
  discount_max: number | null;
  term_months: number | null;
}): Promise<string> {
  const canonical = JSON.stringify([
    a.reference,
    a.vendor_company,
    a.vendor_contact,
    a.vendor_email.toLowerCase(),
    a.title,
    a.body,
    a.discount_min === null ? null : Number(a.discount_min),
    a.discount_max === null ? null : Number(a.discount_max),
    a.term_months === null ? null : Number(a.term_months),
  ]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ------------------------------------------------------------------ */
/* The signing link                                                    */
/* ------------------------------------------------------------------ */

export async function signingLink(id: string): Promise<string | null> {
  const token = await sign("agreement-sign", { id }, LINK_DAYS * 24 * 60 * 60 * 1000);
  return token ? `${siteUrl()}/agreement/${token}` : null;
}

export async function readSigningToken(token: string): Promise<string | null> {
  const payload = await verify<{ id: string }>("agreement-sign", token);
  return payload?.id ?? null;
}

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

export const missingAgreementsTable = (message: string) =>
  /vendor_agreements/.test(message) &&
  /(does not exist|schema cache|relation)/i.test(message);

export async function getAgreement(id: string): Promise<AgreementRow | null> {
  const db = getSupabase();
  if (!db) return null;
  const { data, error } = await db
    .from("vendor_agreements")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return null;
  return (data as AgreementRow) ?? null;
}

/** A merchant's agreements, newest first. Empty if the table is not there. */
export async function agreementsFor(vendorId: string): Promise<AgreementRow[]> {
  const db = getSupabase();
  if (!db) return [];
  const { data, error } = await db
    .from("vendor_agreements")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return [];
  return (data ?? []) as AgreementRow[];
}

/** The latest agreement state per merchant, for the merchant list. */
export async function agreementStatusByVendor(): Promise<
  Record<string, { status: AgreementStatus; at: string }>
> {
  const db = getSupabase();
  if (!db) return {};
  const { data, error } = await db
    .from("vendor_agreements")
    .select("vendor_id,status,created_at,signed_at")
    .not("vendor_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) return {};
  const out: Record<string, { status: AgreementStatus; at: string }> = {};
  for (const row of (data ?? []) as {
    vendor_id: string;
    status: AgreementStatus;
    created_at: string;
    signed_at: string | null;
  }[]) {
    const existing = out[row.vendor_id];
    /* A signed agreement outranks a newer one still waiting or voided. */
    if (!existing || (row.status === "signed" && existing.status !== "signed")) {
      out[row.vendor_id] = { status: row.status, at: row.signed_at ?? row.created_at };
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export const sendAgreementSchema = z.object({
  vendorId: z.string().uuid(),
  title: z.string().trim().min(3).max(160),
  /** The template text, {{fields}} and all. The server fills it in. */
  body: z.string().trim().min(50, "The agreement is too short").max(60_000),
  discountMin: z.union([z.number(), z.string()]).optional().nullable(),
  discountMax: z.union([z.number(), z.string()]).optional().nullable(),
  termMonths: z.coerce.number().int().min(1).max(120),
  startDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker"),
  /** Also record this discount range on the merchant. */
  saveDiscount: z.boolean().optional().default(true),
});

export const signAgreementSchema = z.object({
  token: z.string().min(20).max(2000),
  name: z.string().trim().min(3, "Type your full name").max(120),
  title: z.string().trim().min(2, "Your title or role is needed").max(120),
  consent: z.literal(true, { message: "Tick the box to confirm you agree" }),
});

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

const FONT = "-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif";

/** Who signed, when and how — the block at the bottom of a signed copy. */
export function signatureBlock(a: AgreementRow): string {
  if (a.status !== "signed" || !a.signed_at) return "";
  const when = new Date(a.signed_at).toLocaleString("en-GB", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  });
  return `<div style="margin:30px 0 0;padding:20px 22px;border:1.5px solid #0f7a52;border-radius:14px;background:#f1f8f4;">
  <div style="font:700 11px/1.4 ${FONT};letter-spacing:.09em;text-transform:uppercase;color:#0f7a52;">Signed electronically</div>
  <div style="margin:10px 0 2px;font:italic 400 26px/1.2 Georgia,'Times New Roman',serif;color:#12211b;">${escapeText(
    a.signer_name,
  )}</div>
  <div style="font:600 14px/1.5 ${FONT};color:#12211b;">${escapeText(a.signer_title)}, for ${escapeText(
    a.vendor_company,
  )}</div>
  <div style="margin-top:10px;font:400 13px/1.6 ${FONT};color:#5f736a;">
    ${escapeText(when)} (Lagos time)<br>
    Signed from ${escapeText(a.signer_ip ?? "unknown address")} · link sent to ${escapeText(
      a.vendor_email,
    )}<br>
    Document fingerprint (SHA-256): <span style="font-family:ui-monospace,Menlo,Consolas,monospace;word-break:break-all;">${escapeText(
      a.document_hash,
    )}</span>
  </div>
</div>`;
}

/** The agreement itself, as HTML — for the signing page and for copies. */
export function agreementBodyHtml(a: AgreementRow, size: "email" | "page" = "page"): string {
  return `${renderDoc(a.body, { size })}
<div style="margin:22px 0 0;padding:14px 16px;border:1px solid #e4e2d8;border-radius:12px;background:#f5f4ed;">
  <div style="font:700 11px/1.4 ${FONT};letter-spacing:.08em;text-transform:uppercase;color:#5f736a;">At a glance</div>
  <div style="margin-top:6px;font:400 14.5px/1.6 ${FONT};color:#12211b;">
    Agreed discount: <strong>${escapeText(discountLabel(a.discount_min, a.discount_max))}</strong><br>
    Term: <strong>${escapeText(String(a.term_months ?? "—"))} months</strong><br>
    Reference: <strong>${escapeText(a.reference)}</strong>
  </div>
</div>
${signatureBlock(a)}`;
}

/** A standalone document for printing, saving as PDF or attaching to email. */
export function agreementDocument(a: AgreementRow, options: { printButton?: boolean } = {}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeText(a.title)} — ${escapeText(a.vendor_company)} (${escapeText(a.reference)})</title>
<style>
  @page { margin: 16mm; }
  body { margin:0; background:#eceae0; }
  @media print { body { background:#fff; } .no-print { display:none !important; } .sheet { border:0 !important; margin:0 !important; } }
</style>
</head>
<body>
<div style="max-width:760px;margin:0 auto;padding:28px 16px 48px;">
${
  options.printButton
    ? `<div class="no-print" style="margin:0 0 20px;"><button type="button" onclick="window.print()" style="cursor:pointer;border:0;border-radius:999px;background:#0f7a52;color:#fff;padding:13px 22px;font:700 15px/1 ${FONT};">Print or save as PDF</button></div>`
    : ""
}
<div class="sheet" style="background:#fff;border:1px solid #e4e2d8;border-radius:18px;padding:36px 32px;">
  <div style="margin:0 0 22px;display:flex;justify-content:space-between;gap:12px;">
    <span style="font:800 20px/1 ${FONT};color:#12211b;letter-spacing:-.02em;">Spendbox</span>
    <span style="font:700 12px/1.4 ui-monospace,Menlo,Consolas,monospace;color:#5f736a;">${escapeText(
      a.reference,
    )} · ${escapeText(a.status.toUpperCase())}</span>
  </div>
  ${agreementBodyHtml(a)}
</div>
</div>
</body>
</html>`;
}

export const agreementFilename = (a: AgreementRow) =>
  `${a.reference.replace(/[^A-Za-z0-9-]/g, "")}-${a.status === "signed" ? "signed" : "unsigned"}.html`;

/* ------------------------------------------------------------------ */
/* Emails                                                              */
/* ------------------------------------------------------------------ */

export function requestSignatureEmail(a: AgreementRow, link: string) {
  const first = a.vendor_contact.split(" ")[0];
  const intro = `Hello ${first}. Here is the Memorandum of Understanding between Spendbox and ${a.vendor_company}, including the agreed discount of ${discountLabel(
    a.discount_min,
    a.discount_max,
  )}.\n\nPlease read it and sign it online — it takes a minute. You type your name, confirm, and a signed copy comes straight back to you by email. The link is private to you and works for ${LINK_DAYS} days.`;

  return {
    subject: `Please sign: ${a.title} with Spendbox (${a.reference})`,
    html: layout({
      preheader: `Your agreement with Spendbox is ready to sign — ${discountLabel(
        a.discount_min,
        a.discount_max,
      )} agreed discount.`,
      eyebrow: "Agreement to sign",
      heading: "Your agreement is ready to sign",
      intro,
      reference: a.reference,
      body: "",
      cta: { label: "Read and sign", href: link },
      audience: "You are receiving this because your company supplies through Spendbox.",
      footnote: `If the button does not work, copy this address into your browser:\n${link}\n\nQuestions about any of it? Reply to this email before you sign.`,
    }),
    text: `${intro}\n\nRead and sign: ${link}\n\nReference: ${a.reference}\n\n— Spendbox`,
  };
}

export function signedCopyEmail(a: AgreementRow, audience: "vendor" | "internal") {
  const heading = audience === "vendor" ? "Signed — here is your copy" : `${a.vendor_company} signed`;
  const intro =
    audience === "vendor"
      ? `Thank you, ${a.signer_name}. Your agreement with Spendbox is signed. A copy of exactly what you signed is below and attached for your records.`
      : `${a.signer_name} (${a.signer_title}) signed ${a.reference} for ${a.vendor_company}. The signed copy is attached.`;

  return {
    subject:
      audience === "vendor"
        ? `Signed: ${a.title} with Spendbox (${a.reference})`
        : `[Signed] ${a.vendor_company} · ${a.reference}`,
    html: layout({
      preheader: `${a.reference} signed by ${a.signer_name}`,
      eyebrow: "Agreement signed",
      heading,
      intro,
      reference: a.reference,
      lead: agreementBodyHtml(a, "email"),
      body: "",
      audience:
        audience === "vendor"
          ? "You are receiving this because your company supplies through Spendbox."
          : "Sent to the Spendbox team.",
    }),
    text: `${heading}\n\n${intro}\n\n${plainDoc(a.body)}\n\nSigned by ${a.signer_name}, ${a.signer_title}, on ${a.signed_at}.\nFingerprint: ${a.document_hash}\n\n— Spendbox`,
  };
}

export { smallPrint, fillFields };
