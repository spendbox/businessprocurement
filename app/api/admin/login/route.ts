import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  adminSetupProblem,
  createSession,
  credentialsMatch,
  sessionCookieOptions,
} from "@/lib/admin-auth";
import { rateLimit, clientKey } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // Sign-in is the one endpoint worth throttling hard.
  const limit = rateLimit(`admin-login:${clientKey(request)}`, 8, 10 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      {
        ok: false,
        message: `Too many attempts. Try again in ${Math.ceil(limit.retryAfter / 60)} minutes.`,
      },
      { status: 429 },
    );
  }

  const problem = adminSetupProblem();
  if (problem) {
    return NextResponse.json(
      { ok: false, message: `The dashboard is not set up yet: ${problem}` },
      { status: 503 },
    );
  }

  let email = "";
  let password = "";
  try {
    const body = (await request.json()) as { email?: unknown; password?: unknown };
    if (typeof body.email === "string") email = body.email;
    if (typeof body.password === "string") password = body.password;
  } catch {
    return NextResponse.json(
      { ok: false, message: "We could not read that." },
      { status: 400 },
    );
  }

  if (!credentialsMatch(email, password)) {
    // One message for both cases, so this cannot be used to discover the email.
    return NextResponse.json(
      { ok: false, message: "That email and password do not match." },
      { status: 401 },
    );
  }

  const token = await createSession(email.trim().toLowerCase());
  if (!token) {
    return NextResponse.json(
      { ok: false, message: "Could not start a session." },
      { status: 500 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(SESSION_MAX_AGE));
  return response;
}
