import { NextResponse } from "next/server";
import { guardApi } from "@/lib/admin-guard";
import { Resend } from "resend";

export const runtime = "nodejs";

/**
 * Sends one email and reports exactly what Resend said back.
 *
 * This deliberately talks to the SDK directly rather than going through
 * lib/resend.ts, so nothing on the way can tidy an error into a boolean.
 * Whatever comes back — a verification failure, a test-mode restriction, a
 * bad key — is handed over verbatim, because the whole point is to see it.
 */
export async function POST(request: Request) {
  const guard = await guardApi("admin");
  if (!guard.ok) return guard.response;

  let to = "";
  try {
    const body = (await request.json()) as { to?: unknown };
    if (typeof body.to === "string") to = body.to.trim();
  } catch {
    /* fall through to the check below */
  }

  if (!to || !to.includes("@")) {
    return NextResponse.json(
      { ok: false, stage: "input", message: "Enter an address to send the test to." },
      { status: 400 },
    );
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return NextResponse.json({
      ok: false,
      stage: "config",
      message:
        "RESEND_API_KEY is not set on this deployment. Add it in Vercel and redeploy — note that changing a variable does not take effect until you redeploy.",
    });
  }

  const from = process.env.EMAIL_FROM ?? "Spendbox <onboarding@resend.dev>";

  try {
    const resend = new Resend(key);
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: "Spendbox test email",
      text:
        "This is a test from the Spendbox dashboard.\n\n" +
        "If you are reading it, sending works and the problem is elsewhere.",
      html:
        '<div style="font:16px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#12211b">' +
        "<p><strong>This is a test from the Spendbox dashboard.</strong></p>" +
        "<p>If you are reading it, sending works and the problem is elsewhere.</p>" +
        `<p style="color:#5f736a;font-size:14px">Sent from <code>${from.replace(/[<>]/g, "")}</code></p>` +
        "</div>",
    });

    if (error) {
      console.error("[spendbox] test email rejected by Resend", { from, to, error });
      return NextResponse.json({
        ok: false,
        stage: "resend",
        from,
        to,
        // The raw error is the useful part — do not summarise it.
        name: error.name,
        message: error.message,
      });
    }

    console.log("[spendbox] test email accepted", { from, to, id: data?.id });
    return NextResponse.json({ ok: true, stage: "sent", from, to, id: data?.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[spendbox] test email threw", { from, to, message });
    return NextResponse.json({ ok: false, stage: "network", from, to, message });
  }
}
