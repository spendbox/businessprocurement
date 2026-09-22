import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, isAdmin, readSession, type AdminSession } from "./admin-auth";
import { COORDINATOR_HOME } from "./roles";

/**
 * One place that answers "who is asking, and may they?".
 *
 * The middleware already turns anonymous visitors away, and hides the links a
 * coordinator may not use. Neither is a permission check: a link can be typed
 * and middleware can be misconfigured, so every page and every route that
 * could show or change something a coordinator must not see asks here too.
 */

export async function currentSession(): Promise<AdminSession | null> {
  return readSession((await cookies()).get(SESSION_COOKIE)?.value);
}

/** For a page only an admin may see. Sends a coordinator back to their work. */
export async function requireAdminPage(): Promise<AdminSession> {
  const session = await currentSession();
  if (!session) redirect("/admin/login");
  if (!isAdmin(session)) redirect(COORDINATOR_HOME);
  return session;
}

/** For a page any signed-in person may see. */
export async function requirePage(): Promise<AdminSession> {
  const session = await currentSession();
  if (!session) redirect("/admin/login");
  return session;
}

export type ApiGuard =
  | { ok: true; session: AdminSession }
  | { ok: false; response: NextResponse };

/** For a route handler. Returns the refusal to send back, or the session. */
export async function guardApi(
  need: "signed-in" | "admin" = "signed-in",
): Promise<ApiGuard> {
  const session = await currentSession();
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, message: "Not signed in." },
        { status: 401 },
      ),
    };
  }
  if (need === "admin" && !isAdmin(session)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          message: "Your account cannot do that. Ask an admin.",
        },
        { status: 403 },
      ),
    };
  }
  return { ok: true, session };
}
