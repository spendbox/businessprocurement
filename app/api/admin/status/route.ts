import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, readSession } from "@/lib/admin-auth";
import { getSupabase } from "@/lib/supabase";
import { REQUEST_STATUSES, VENDOR_STATUSES } from "@/lib/admin-data";

export const runtime = "nodejs";

/** Moves a request or a merchant along your workflow. */
export async function POST(request: Request) {
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

  let kind = "";
  let id = "";
  let status = "";
  let internalNotes: string | undefined;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    kind = String(body.kind ?? "");
    id = String(body.id ?? "");
    status = String(body.status ?? "");
    if (typeof body.internalNotes === "string") internalNotes = body.internalNotes;
  } catch {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }

  const table =
    kind === "request"
      ? "procurement_requests"
      : kind === "vendor"
        ? "vendor_applications"
        : null;
  if (!table || !id) {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }

  const allowed: readonly string[] =
    kind === "request" ? REQUEST_STATUSES : VENDOR_STATUSES;

  const patch: Record<string, unknown> = {};
  if (status) {
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { ok: false, message: "That is not a status we use." },
        { status: 422 },
      );
    }
    patch.status = status;
  }
  if (internalNotes !== undefined) {
    patch.internal_notes = internalNotes.slice(0, 4000) || null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, message: "Nothing to change." }, { status: 400 });
  }

  const { error } = await db.from(table).update(patch).eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
