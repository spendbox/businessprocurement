import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  adminSetupProblem,
  createSession,
  credentialsMatch,
  sessionCookieOptions,
} from "@/lib/admin-auth";
import {
  COORDINATOR_HOME,
  findMemberByEmail,
  noteSignIn,
  passwordMatches,
  roleCanSignIn,
} from "@/lib/team";
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

  /*
   * The owner account first, then the team table. Checking the owner first
   * means a broken or missing team table can never lock you out of your own
   * dashboard, and a team row can never shadow the owner's email.
   */
  let token: string | null = null;
  let home = "/admin";

  if (credentialsMatch(email, password)) {
    token = await createSession(email.trim().toLowerCase(), { role: "admin" });
  } else {
    const found = await findMemberByEmail(email);
    /* A marketer never signs in, whatever might be sitting in the row. */
    const member = found && roleCanSignIn(found.role) ? found : null;
    const passwordOk = await passwordMatches(password, member?.password_hash ?? null);

    if (member && member.active && passwordOk) {
      token = await createSession(member.email, {
        role: member.role,
        name: member.name,
        memberId: member.id,
      });
      home = member.role === "coordinator" ? COORDINATOR_HOME : "/admin";
      await noteSignIn(member.id);
    } else if (member && passwordOk && !member.active) {
      return NextResponse.json(
        {
          ok: false,
          message: "That account has been switched off. Ask an admin to turn it back on.",
        },
        { status: 403 },
      );
    }
  }

  if (!token) {
    // One message for both cases, so this cannot be used to discover the email.
    return NextResponse.json(
      { ok: false, message: "That email and password do not match." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true, home });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(SESSION_MAX_AGE));
  return response;
}
