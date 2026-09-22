import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { fieldErrors } from "@/lib/schemas";
import { rateLimit, clientKey } from "@/lib/ratelimit";
import { sendInternal, sendToCustomer } from "@/lib/resend";
import {
  agreementDocument,
  agreementFilename,
  fingerprint,
  getAgreement,
  readSigningToken,
  signAgreementSchema,
  signedCopyEmail,
  type AgreementRow,
} from "@/lib/agreements";

export const runtime = "nodejs";

/**
 * A merchant signing their agreement. Public — the signed link IS the
 * permission — so everything is checked here, in this order:
 *
 *   the link is genuine and in date → the agreement exists → it is still
 *   waiting to be signed → its words still match the fingerprint taken when
 *   it was sent → the signer typed a name, a title and ticked consent.
 *
 * The update only succeeds if the row is still 'sent', so two clicks, or two
 * people with the same link, can never both sign.
 */
export async function POST(request: Request) {
  const limit = rateLimit(`agreement-sign:${clientKey(request)}`, 10, 10 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, message: "Too many attempts. Try again in a few minutes." },
      { status: 429 },
    );
  }

  const db = getSupabase();
  if (!db) {
    return NextResponse.json(
      { ok: false, message: "Signing is not available right now. Please reply to the email instead." },
      { status: 503 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "We could not read that." }, { status: 400 });
  }

  const parsed = signAgreementSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "A little more is needed to sign.", errors: fieldErrors(parsed.error) },
      { status: 422 },
    );
  }
  const input = parsed.data;

  const id = await readSigningToken(input.token);
  if (!id) {
    return NextResponse.json(
      {
        ok: false,
        message: "This signing link has expired or is not valid. Ask Spendbox to send you a fresh one.",
      },
      { status: 401 },
    );
  }

  const agreement = await getAgreement(id);
  if (!agreement) {
    return NextResponse.json({ ok: false, message: "This agreement no longer exists." }, { status: 404 });
  }
  if (agreement.status === "signed") {
    return NextResponse.json({ ok: false, message: "This agreement is already signed." }, { status: 409 });
  }
  if (agreement.status === "void") {
    return NextResponse.json(
      { ok: false, message: "This agreement was withdrawn. Spendbox will send you the current one." },
      { status: 410 },
    );
  }

  /* The words must be the words that were sent. */
  if ((await fingerprint(agreement)) !== agreement.document_hash) {
    console.error("[spendbox] agreement fingerprint MISMATCH — refusing to sign", {
      reference: agreement.reference,
    });
    return NextResponse.json(
      {
        ok: false,
        message: "This agreement has changed since it was sent, so it cannot be signed. Spendbox has been told.",
      },
      { status: 409 },
    );
  }

  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";

  const { data, error } = await db
    .from("vendor_agreements")
    .update({
      status: "signed",
      signed_at: new Date().toISOString(),
      signer_name: input.name,
      signer_title: input.title,
      signer_ip: ip.slice(0, 64),
      signer_agent: (request.headers.get("user-agent") ?? "").slice(0, 300),
    })
    .eq("id", agreement.id)
    .eq("status", "sent")
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, message: "Signing failed. Please try again." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, message: "This agreement is already signed." }, { status: 409 });
  }

  const signed = data as AgreementRow;
  const attachment = {
    filename: agreementFilename(signed),
    content: Buffer.from(agreementDocument(signed), "utf8").toString("base64"),
  };

  /* Copies to both sides. A failed email never un-signs the agreement. */
  const [vendorCopy, internalCopy] = await Promise.all([
    sendToCustomer({ to: signed.vendor_email, ...signedCopyEmail(signed, "vendor"), attachments: [attachment] }),
    sendInternal({ ...signedCopyEmail(signed, "internal"), attachments: [attachment] }),
  ]);
  if (!vendorCopy.ok || !internalCopy.ok) {
    console.error("[spendbox] signed-copy email problem", {
      reference: signed.reference,
      vendor: vendorCopy.error,
      internal: internalCopy.error,
    });
  }

  return NextResponse.json({
    ok: true,
    copySent: vendorCopy.ok,
    message: vendorCopy.ok
      ? `Signed. A copy is on its way to ${signed.vendor_email}.`
      : "Signed. We could not email your copy just now — Spendbox will send it.",
  });
}
