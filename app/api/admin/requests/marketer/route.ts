import { NextResponse } from "next/server";
import { guardApi } from "@/lib/admin-guard";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * Records which marketer brought a business in, which is what their
 * "businesses on board" and "sales" targets are counted from.
 *
 * Open to coordinators as well as admins: they are the ones on the phone
 * when a business says "Ada sent me". Setting it reveals no figures.
 */
export async function POST(request: Request) {
  const guard = await guardApi("signed-in");
  if (!guard.ok) return guard.response;

  const db = getSupabase();
  if (!db) {
    return NextResponse.json({ ok: false, message: "Supabase is not configured." }, { status: 503 });
  }

  let requestId = "";
  let marketerId: string | null = null;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    requestId = String(body.requestId ?? "");
    marketerId = typeof body.marketerId === "string" && body.marketerId ? body.marketerId : null;
  } catch {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }
  if (!requestId) {
    return NextResponse.json({ ok: false, message: "Which request?" }, { status: 400 });
  }

  if (marketerId) {
    const { data } = await db
      .from("team_members")
      .select("role")
      .eq("id", marketerId)
      .maybeSingle();
    if ((data as { role?: string } | null)?.role !== "marketer") {
      return NextResponse.json({ ok: false, message: "That person is not a marketer." }, { status: 422 });
    }
  }

  const { error } = await db
    .from("procurement_requests")
    .update({ marketer_id: marketerId })
    .eq("id", requestId);

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        message: /marketer_id/.test(error.message)
          ? "Run supabase/schema.sql in the Supabase SQL editor first — this needs the marketer column."
          : error.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, message: marketerId ? "Saved." : "Cleared." });
}
