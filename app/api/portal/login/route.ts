import { NextResponse } from "next/server";
import { z } from "zod";
import { createLoginToken, normaliseEmail } from "@/lib/portal-auth";
import { layout, textVersion } from "@/lib/email";
import { sendToCustomer, emailConfigured } from "@/lib/resend";
import { getSupabase } from "@/lib/supabase";
import { rateLimit, clientKey } from "@/lib/ratelimit";

export const runtime = "nodejs";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://spendbox.site";

const schema = z.object({ email: z.string().trim().toLowerCase().email() });

/**
 * Emails a sign-in link.
 *
 * Always answers the same way, whether or not that address has ever sent us
 * anything. Saying "no account found" would turn this into a way to test
 * which businesses we work with.
 */
export async function POST(request: Request) {
  const limit = rateLimit(`portal-login:${clientKey(request)}`, 6, 15 * 60 * 1000);
  const sameForEveryone = NextResponse.json({
    ok: true,
    message: "If we have anything under that address, a sign-in link is on its way.",
  });

  if (!limit.ok) {
    return NextResponse.json(
      {
        ok: false,
        message: `Too many attempts. Try again in ${Math.ceil(limit.retryAfter / 60)} minutes.`,
      },
      { status: 429 },
    );
  }

  let parsed;
  try {
    parsed = schema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, message: "Enter a valid email." }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Enter a valid email." }, { status: 422 });
  }

  const email = normaliseEmail(parsed.data.email);

  if (!emailConfigured()) {
    console.error("[spendbox] portal sign-in impossible — RESEND_API_KEY missing");
    return NextResponse.json(
      { ok: false, message: "Sign-in is not available on this deployment yet." },
      { status: 503 },
    );
  }

  const db = getSupabase();
  if (!db) {
    return NextResponse.json(
      {
        ok: false,
        message: "Sign-in needs the database, which is not connected on this deployment.",
      },
      { status: 503 },
    );
  }

  /* Only send a link where there is actually something to look at. */
  const [requests, vendors] = await Promise.all([
    db.from("procurement_requests").select("id").eq("email", email).limit(1),
    db.from("vendor_applications").select("id").eq("email", email).limit(1),
  ]);
  const known = (requests.data?.length ?? 0) > 0 || (vendors.data?.length ?? 0) > 0;

  if (!known) {
    console.log("[spendbox] portal sign-in for an unknown address", { email });
    return sameForEveryone;
  }

  const token = await createLoginToken(email);
  if (!token) {
    console.error("[spendbox] portal sign-in impossible — ADMIN_SESSION_SECRET missing or short");
    return NextResponse.json(
      { ok: false, message: "Sign-in is not configured on this deployment yet." },
      { status: 503 },
    );
  }

  const link = `${siteUrl()}/portal/verify?token=${encodeURIComponent(token)}`;
  const result = await sendToCustomer({
    to: email,
    subject: "Your Spendbox sign-in link",
    html: layout({
      preheader: "Your sign-in link — good for 30 minutes.",
      eyebrow: "Sign in",
      heading: "Here is your sign-in link",
      intro:
        "Tap the button to see your requests and their status. The link works for 30 minutes and only on this address.\n\nIf you did not ask for it, ignore this email — nothing has changed.",
      body: "",
      cta: { label: "Open my requests", href: link },
      footnote: "Trouble with the button? Copy this into your browser:\n" + link,
    }),
    text: textVersion("Your Spendbox sign-in link", undefined, [
      { label: "Link (good for 30 minutes)", value: link },
    ]),
  });

  if (!result.ok) {
    console.error("[spendbox] portal sign-in email FAILED", { email, error: result.error });
    return NextResponse.json(
      { ok: false, message: "We could not send the link just now. Try again shortly." },
      { status: 502 },
    );
  }

  console.log("[spendbox] portal sign-in link sent", { email });
  return sameForEveryone;
}
