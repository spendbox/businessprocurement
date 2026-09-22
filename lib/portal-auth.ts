import { sign, verify } from "./signing";

/**
 * Sign-in for businesses and merchants.
 *
 * No passwords: a request is already tied to the email it was sent from, so
 * proving you can read that inbox is exactly the right test, and it is one
 * fewer credential for a buyer to invent and forget. Signing in is never
 * required — it only ever shows you what you already submitted.
 */

export const PORTAL_COOKIE = "spendbox_portal";

/** Long enough to be useful, short enough that a stale phone logs out. */
export const PORTAL_SESSION_DAYS = 30;
export const PORTAL_SESSION_MAX_AGE = PORTAL_SESSION_DAYS * 24 * 60 * 60;

/** A link sitting in an inbox should not stay usable for long. */
const LOGIN_LINK_TTL_MS = 30 * 60 * 1000;

export type PortalSession = { email: string; exp: number };

export const normaliseEmail = (email: string) => email.trim().toLowerCase();

export async function createLoginToken(email: string): Promise<string | null> {
  return sign("portal-login", { email: normaliseEmail(email) }, LOGIN_LINK_TTL_MS);
}

export async function readLoginToken(token: string | undefined): Promise<string | null> {
  const payload = await verify<{ email: string }>("portal-login", token);
  return payload?.email ?? null;
}

export async function createPortalSession(email: string): Promise<string | null> {
  return sign(
    "portal-session",
    { email: normaliseEmail(email) },
    PORTAL_SESSION_MAX_AGE * 1000,
  );
}

export async function readPortalSession(
  token: string | undefined,
): Promise<PortalSession | null> {
  return verify<{ email: string }>("portal-session", token);
}
