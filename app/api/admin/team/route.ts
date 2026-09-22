import { NextResponse } from "next/server";
import { guardApi } from "@/lib/admin-guard";
import { getSupabase } from "@/lib/supabase";
import { fieldErrors } from "@/lib/schemas";
import {
  hashPassword,
  missingTeamTable,
  newMemberSchema,
  roleCanSignIn,
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
      password_hash:
        member.password && roleCanSignIn(member.role)
          ? await hashPassword(member.password)
          : null,
      started_on:
        member.startedOn ||
        (member.role === "marketer" ? new Date().toISOString().slice(0, 10) : null),
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
    message:
      member.role === "marketer"
        ? `${created.name} added as a marketer. Assign them merchants and send them the playbook.`
        : member.password
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

  /* What the person is now, to decide whether a password may go with it. */
  const { data: current } = await db
    .from("team_members")
    .select("role")
    .eq("id", id)
    .maybeSingle();
  const finalRole = rest.role ?? (current as { role?: string } | null)?.role;

  if (password && finalRole === "marketer") {
    return NextResponse.json(
      { ok: false, message: "Marketers do not sign in, so they cannot have a password." },
      { status: 422 },
    );
  }

  const patch: Record<string, unknown> = {};
  if (rest.name !== undefined) patch.name = rest.name;
  if (rest.email !== undefined) patch.email = rest.email;
  if (rest.phone !== undefined) patch.phone = rest.phone || null;
  if (rest.role !== undefined) patch.role = rest.role;
  if (rest.active !== undefined) patch.active = rest.active;
  if (rest.notes !== undefined) patch.notes = rest.notes || null;
  if (rest.startedOn !== undefined) patch.started_on = rest.startedOn || null;
  if (password) patch.password_hash = await hashPassword(password);
  if (removePassword) patch.password_hash = null;
  /* Becoming a marketer takes any sign-in away with it. */
  if (rest.role === "marketer") patch.password_hash = null;

  /* Nobody demotes themselves out of the dashboard by accident. */
  if (
    guard.session.memberId === id &&
    ((rest.role && rest.role !== "admin") || rest.active === false)
  ) {
    return NextResponse.json(
      { ok: false, message: "You cannot change your own role or switch yourself off." },
      { status: 409 },
    );
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, message: "Nothing to change." }, { status: 400 });
  }

  const { error } = await db.from("team_members").update(patch).eq("id", id);
  if (error) {
    const duplicate = /duplicate key|unique/i.test(error.message);
    return NextResponse.json(
      {
        ok: false,
        message: duplicate
          ? "Someone else on the team already uses that email address."
          : needsTable(error.message),
      },
      { status: duplicate ? 409 : 500 },
    );
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
 * Their work can be handed to someone else in the same breath. Without a
 * hand-over the database sets it back to nobody — no merchant, request or
 * agreement ever disappears with the person.
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
  let reassignTo = "";
  try {
    const body = (await request.json()) as Record<string, unknown>;
    id = String(body.id ?? "");
    if (typeof body.reassignTo === "string") reassignTo = body.reassignTo;
  } catch {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }
  if (!id) {
    return NextResponse.json({ ok: false, message: "Which person?" }, { status: 400 });
  }
  if (reassignTo && reassignTo === id) {
    return NextResponse.json(
      { ok: false, message: "Pick someone else to hand their work to." },
      { status: 400 },
    );
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

  /*
   * Hand their work over first, so it is never left orphaned by accident.
   * Without a hand-over the database simply unassigns it — nothing about a
   * merchant or a request is ever deleted with the person.
   */
  let moved = 0;
  if (reassignTo) {
    const { data: target } = await db
      .from("team_members")
      .select("role")
      .eq("id", reassignTo)
      .maybeSingle();
    if (!target) {
      return NextResponse.json(
        { ok: false, message: "The person to hand over to is not on the team." },
        { status: 404 },
      );
    }
    /*
     * Marketing work only goes to a marketer, and looking after a merchant
     * only to someone who can sign in — a hand-over never puts work in a
     * column the new person could not hold.
     */
    const toMarketer = (target as { role: string }).role === "marketer";
    const columns = toMarketer
      ? ([
          ["vendor_applications", "marketer_id"],
          ["procurement_requests", "marketer_id"],
        ] as const)
      : ([["vendor_applications", "assigned_to"]] as const);

    for (const [table, column] of columns) {
      const { data: rows, error: moveError } = await db
        .from(table)
        .update({ [column]: reassignTo })
        .eq(column, id)
        .select("id");
      /* A column not yet migrated just has nothing to move. */
      if (!moveError && table === "vendor_applications") moved += rows?.length ?? 0;
    }
  }

  const { error } = await db.from("team_members").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, message: needsTable(error.message) }, { status: 500 });
  }

  const name = (existing as { name: string } | null)?.name ?? "That person";
  return NextResponse.json({
    ok: true,
    message: reassignTo
      ? `${name} removed. ${moved} merchant${moved === 1 ? "" : "s"} handed over.`
      : `${name} removed from the team. Anything they had is now unassigned.`,
  });
}
