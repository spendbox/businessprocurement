import { NextResponse } from "next/server";
import { guardApi } from "@/lib/admin-guard";
import { displayName } from "@/lib/admin-auth";
import { getSupabase } from "@/lib/supabase";
import { sendToCustomer, emailConfigured } from "@/lib/resend";
import { assignmentEmail, logTeamEmail, type MarketerVendor } from "@/lib/marketers";

export const runtime = "nodejs";

/**
 * Assigns a merchant to a marketer, moves it from one to another, or takes
 * it away. One route for all three, because they are one action: "this
 * merchant is now worked by X" — where X may be nobody.
 */
export async function POST(request: Request) {
  const guard = await guardApi("admin");
  if (!guard.ok) return guard.response;

  const db = getSupabase();
  if (!db) {
    return NextResponse.json({ ok: false, message: "Supabase is not configured." }, { status: 503 });
  }

  let vendorId = "";
  let marketerId: string | null = null;
  let notify = false;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    vendorId = String(body.vendorId ?? "");
    marketerId = typeof body.marketerId === "string" && body.marketerId ? body.marketerId : null;
    notify = body.notify === true;
  } catch {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }
  if (!vendorId) {
    return NextResponse.json({ ok: false, message: "Which merchant?" }, { status: 400 });
  }

  type Marketer = { id: string; name: string; email: string; role: string; active: boolean };
  let marketer: Marketer | null = null;
  if (marketerId) {
    const { data } = await db
      .from("team_members")
      .select("id,name,email,role,active")
      .eq("id", marketerId)
      .maybeSingle();
    marketer = (data as Marketer | null) ?? null;
    if (!marketer || marketer.role !== "marketer") {
      return NextResponse.json(
        { ok: false, message: "That person is not a marketer." },
        { status: 422 },
      );
    }
  }

  const { data: before } = await db
    .from("vendor_applications")
    .select("marketer_id")
    .eq("id", vendorId)
    .maybeSingle();
  const previous = (before as { marketer_id: string | null } | null)?.marketer_id ?? null;

  const { data: updated, error } = await db
    .from("vendor_applications")
    .update({ marketer_id: marketerId })
    .eq("id", vendorId)
    .select(
      "id,company,reference,contact_name,email,phone,categories,regions,status,discount_min,discount_max,marketer_id",
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        message: /marketer_id|discount_/.test(error.message)
          ? "Run supabase/schema.sql in the Supabase SQL editor first — this needs the marketer columns."
          : error.message,
      },
      { status: 500 },
    );
  }
  if (!updated) {
    return NextResponse.json({ ok: false, message: "Merchant not found." }, { status: 404 });
  }
  const vendor = updated as MarketerVendor;

  let emailNote = "";
  if (notify && marketer) {
    if (!emailConfigured()) {
      emailNote = " Resend is not configured, so they were not emailed.";
    } else {
      const mail = assignmentEmail(marketer, vendor, Boolean(previous && previous !== marketerId));
      const result = await sendToCustomer({ to: marketer.email, ...mail });
      await logTeamEmail({
        memberId: marketer.id,
        to: marketer.email,
        subject: mail.subject,
        included: ["assignment"],
        ok: result.ok,
        error: result.error,
        sentBy: displayName(guard.session),
      });
      emailNote = result.ok ? ` ${marketer.name} has been emailed.` : ` The email failed: ${result.error}`;
    }
  }

  const message = !marketerId
    ? `${vendor.company} is no longer assigned to a marketer.`
    : previous && previous !== marketerId
      ? `${vendor.company} moved to ${marketer!.name}.${emailNote}`
      : `${vendor.company} assigned to ${marketer!.name}.${emailNote}`;

  return NextResponse.json({ ok: true, message });
}
