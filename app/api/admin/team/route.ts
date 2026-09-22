import { NextResponse } from "next/server";
import { guardApi } from "@/lib/admin-guard";
import { getSupabase } from "@/lib/supabase";
import { fieldErrors } from "@/lib/schemas";
import {
  hashPassword,
  missingTeamTable,
  newMemberSchema,
  updateMemberSchema,
} from "@/lib/team";

export const runtime = "nodejs";

const needsTable = (message: string) =>
  missingTeamTable(message)
    ? "The team_members table is not in the database yet. Run supabase/schema.sql in the Supabase SQL editor, then try again."
    : message;

/** Adds someone to the team. */
export async function POST(request: Request) {
  const guard = await guardApi("admin");
  if (!guard.ok) return guard.response;

  const db = getSupabase();
  if (!db) {
    return NextResponse.json(
      { ok: false, message: "Supabase is not configured, so there is nowhere to save them." },
      { status: 503 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }

  const parsed = newMemberSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "Some of those details need another look.",
        errors: fieldErrors(parsed.error),
      },
      { status: 422 },
    );
  }

  const member = parsed.data;

  const { data, error } = await db
    .from("team_members")
    .insert({
      name: member.name,
      email: member.email,
      phone: member.phone || null,
      role: member.role,
      notes: member.notes || null,
      password_hash: member.password ? await hashPassword(member.password) : null,
    })
    .select("id,name,email,role")
    .single();

  if (error) {
    const duplicate = /duplicate key|unique/i.test(error.message);
    return NextResponse.json(
      {
        ok: false,
        message: duplicate
          ? "Someone with that email address is already on the team."
          : needsTable(error.message),
      },
      { status: duplicate ? 409 : 500 },
    );
  }

  const created = data as { id: string; name: string };
  return NextResponse.json({
    ok: true,
    id: created.id,
    message: member.password
      ? `${created.name} added, and can sign in with that password.`
      : `${created.name} added. Give them a password when they need to sign in.`,
  });
}

/** Changes a name, a role, a password, or switches an account off. */
export async function PATCH(request: Request) {
  const guard = await guardApi("admin");
  if (!guard.ok) return guard.response;

  const db = getSupabase();
  if (!db) {
    return NextResponse.json(
      { ok: false, message: "Supabase is not configured." },
      { status: 503 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }

  const parsed = updateMemberSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "That change could not be made.",
        errors: fieldErrors(parsed.error),
      },
      { status: 422 },
    );
  }

  const { id, password, removePassword, ...rest } = parsed.data;

  const patch: Record<string, unknown> = {};
  if (rest.name !== undefined) patch.name = rest.name;
  if (rest.phone !== undefined) patch.phone = rest.phone || null;
  if (rest.role !== undefined) patch.role = rest.role;
  if (rest.active !== undefined) patch.active = rest.active;
  if (rest.notes !== undefined) patch.notes = rest.notes || null;
  if (password) patch.password_hash = await hashPassword(password);
  if (removePassword) patch.password_hash = null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, message: "Nothing to change." }, { status: 400 });
  }

  const { error } = await db.from("team_members").update(patch).eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, message: needsTable(error.message) }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: password
      ? "Saved — their new password works from now on."
      : removePassword
        ? "Saved — they can no longer sign in."
        : "Saved.",
  });
}

/**
 * Removes someone from the team.
 *
 * Merchants they looked after are not touched: the database sets their owner
 * back to nobody, so no merchant record disappears with the person.
 */
export async function DELETE(request: Request) {
  const guard = await guardApi("admin");
  if (!guard.ok) return guard.response;

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
    return NextResponse.json({ ok: false, message: "Which person?" }, { status: 400 });
  }

  /* Signing yourself out of your own account by deleting it helps nobody. */
  if (guard.session.memberId === id) {
    return NextResponse.json(
      { ok: false, message: "You cannot delete the account you are signed in with." },
      { status: 409 },
    );
  }

  const { data: existing } = await db
    .from("team_members")
    .select("name")
    .eq("id", id)
    .maybeSingle();

  const { error } = await db.from("team_members").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, message: needsTable(error.message) }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: `${(existing as { name: string } | null)?.name ?? "That person"} removed from the team.`,
  });
}
