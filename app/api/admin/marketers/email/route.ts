import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi } from "@/lib/admin-guard";
import { displayName } from "@/lib/admin-auth";
import { getSupabase } from "@/lib/supabase";
import { fieldErrors } from "@/lib/schemas";
import { sendToCustomer, emailConfigured } from "@/lib/resend";
import { getDocument, targetsFrom } from "@/lib/documents";
import { fieldsIn, fillFields } from "@/lib/doc-render";
import {
  INCLUDE_OPTIONS,
  composeMarketerEmail,
  logTeamEmail,
  marketerFields,
  marketerForEmail,
} from "@/lib/marketers";

export const runtime = "nodejs";

const schema = z.object({
  memberIds: z.array(z.string().uuid()).min(1, "Pick at least one marketer").max(200),
  subject: z.string().trim().min(3, "Give the email a subject").max(200),
  message: z.string().trim().min(5, "Write a message").max(20_000),
  include: z.array(z.enum(INCLUDE_OPTIONS)).max(INCLUDE_OPTIONS.length).default([]),
  /** Returns the first person's email without sending anything. */
  preview: z.boolean().optional(),
});

/**
 * Writes to marketers — each one gets their own email, with their name,
 * their merchants, their numbers and their deadlines filled in.
 */
export async function POST(request: Request) {
  const guard = await guardApi("admin");
  if (!guard.ok) return guard.response;

  if (!getSupabase()) {
    return NextResponse.json({ ok: false, message: "Supabase is not configured." }, { status: 503 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "The email needs another look.", errors: fieldErrors(parsed.error) },
      { status: 422 },
    );
  }
  const input = parsed.data;

  const playbook = await getDocument("marketer_playbook");
  const targets = targetsFrom(playbook.meta);

  /* Catch a mistyped {{field}} before it lands in anyone's inbox. */
  const probe = marketerFields(
    { name: "Test" },
    [],
    { start: "2026-01-01", businessDeadline: "2026-01-30", salesDeadline: "2026-03-31", businesses: 0, sales: 0, businessesAllTime: 0, salesAllTime: 0 },
    targets,
  );
  const unknown = [
    ...fieldsIn(fillFields(input.subject, probe)),
    ...fieldsIn(fillFields(input.message, probe)),
  ];
  if (unknown.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        message: `These fields do not exist: ${[...new Set(unknown)].map((f) => `{{${f}}}`).join(", ")}.`,
      },
      { status: 422 },
    );
  }

  if (input.preview) {
    const who = await marketerForEmail(input.memberIds[0], targets);
    if (!who) {
      return NextResponse.json({ ok: false, message: "Marketer not found." }, { status: 404 });
    }
    const mail = composeMarketerEmail(input, who, targets, playbook);
    return NextResponse.json({ ok: true, to: who.member.email, subject: mail.subject, html: mail.html });
  }

  if (!emailConfigured()) {
    return NextResponse.json(
      { ok: false, message: "Resend is not configured, so nothing can be sent." },
      { status: 503 },
    );
  }

  const sentBy = displayName(guard.session);
  const results: { name: string; ok: boolean; error?: string }[] = [];

  /* One at a time, so a slow provider never sees a burst and each is logged. */
  for (const id of input.memberIds) {
    const who = await marketerForEmail(id, targets);
    if (!who || who.member.role !== "marketer") {
      results.push({ name: id, ok: false, error: "not a marketer" });
      continue;
    }
    const mail = composeMarketerEmail(input, who, targets, playbook);
    const result = await sendToCustomer({ to: who.member.email, ...mail });
    await logTeamEmail({
      memberId: who.member.id,
      to: who.member.email,
      subject: mail.subject,
      included: input.include,
      ok: result.ok,
      error: result.error,
      sentBy,
    });
    results.push({ name: who.member.name, ok: result.ok, error: result.error });
  }

  const sent = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  return NextResponse.json({
    ok: sent.length > 0,
    sent: sent.length,
    failed,
    message:
      failed.length === 0
        ? `Sent to ${sent.length} marketer${sent.length === 1 ? "" : "s"}, each one written for them.`
        : `Sent to ${sent.length}. Not sent to: ${failed.map((f) => `${f.name} (${f.error})`).join(", ")}.`,
  });
}
