import { NextResponse, type NextRequest } from "next/server";
import {
  PORTAL_COOKIE,
  PORTAL_SESSION_MAX_AGE,
  createPortalSession,
  readLoginToken,
} from "@/lib/portal-auth";
import { cookieOptions } from "@/lib/signing";
import { portalEnabled } from "@/lib/features";

export const runtime = "nodejs";

/** Turns a link from an email into a signed-in session. */
export async function GET(request: NextRequest) {
  if (!portalEnabled()) return new NextResponse(null, { status: 404 });

  const token = request.nextUrl.searchParams.get("token") ?? undefined;
  const email = await readLoginToken(token);

  /**
   * Relative on purpose. Building an absolute URL means trusting whatever
   * host the framework reports, which is not always the one the browser
   * used — and a cookie set on one host is not sent to the other.
   */
  const redirectTo = (path: string) =>
    new NextResponse(null, { status: 303, headers: { Location: path } });

  if (!email) {
    return redirectTo("/portal/login?expired=1");
  }

  const session = await createPortalSession(email);
  if (!session) {
    return redirectTo("/portal/login?error=1");
  }

  const response = redirectTo("/portal");
  response.cookies.set(PORTAL_COOKIE, session, cookieOptions(PORTAL_SESSION_MAX_AGE));
  return response;
}
