import { NextResponse } from "next/server";
import { guardApi } from "@/lib/admin-guard";
import { displayName } from "@/lib/admin-auth";
import { getSupabase } from "@/lib/supabase";
import { fieldErrors } from "@/lib/schemas";
import { missingDocumentsTable, saveDocumentSchema } from "@/lib/documents";

export const runtime = "nodejs";

/** Saves your version of the playbook or the agreement template. */
export async function PUT(request: Request) {
  const guard = await guardApi("admin");
  if (!guard.ok) return guard.response;

  const db = getSupabase();
  if (!db) {
    return NextResponse.json({ ok: false, message: "Supabase is not configured." }, { status: 503 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }

  const parsed = saveDocumentSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "That cannot be saved yet.", errors: fieldErrors(parsed.error) },
      { status: 422 },
    );
  }
  const input = parsed.data;

  const hint = (message: string) =>
    missingDocumentsTable(message)
      ? "The app_documents table is not in the database yet. Run supabase/schema.sql in the Supabase SQL editor, then save again."
      : message;

  if (input.reset) {
    const { error } = await db.from("app_documents").delete().eq("key", input.key);
    if (error) return NextResponse.json({ ok: false, message: hint(error.message) }, { status: 500 });
    return NextResponse.json({ ok: true, message: "Back to the original text." });
  }

  const { error } = await db.from("app_documents").upsert(
    {
      key: input.key,
      title: input.title,
      body: input.body,
      meta: input.meta,
      updated_at: new Date().toISOString(),
      updated_by: displayName(guard.session),
    },
    { onConflict: "key" },
  );

  if (error) return NextResponse.json({ ok: false, message: hint(error.message) }, { status: 500 });
  return NextResponse.json({ ok: true, message: "Saved. This version is used from now on." });
}
