/**
 * Admin sign-in.
 *
 * The owner's credentials live in environment variables, so the way back in
 * is always a Vercel settings change — no user table to get locked out of.
 * Everyone else is a row in `team_members` with a hashed password, added
 * from the dashboard, and carries a role: an admin sees everything, a
 * coordinator sees requests and no statistics.
 *
 * The session is a cookie carrying a payload and an HMAC of that payload.
 * Nothing is stored server-side, and the cookie cannot be forged without
 * ADMIN_SESSION_SECRET. Built on Web Crypto so the same code runs in
 * middleware (edge) and in route handlers (node).
 */

import { cookieOptions, secret, sign, verify } from "./signing";
import type { Role } from "./roles";

export const SESSION_COOKIE = "spendbox_admin";
const SESSION_DAYS = 7;

export type AdminSession = {
  email: string;
  /** Missing on a cookie issued before roles existed — treated as admin. */
  role?: Role;
  name?: string;
  /** The team_members row, when this is not the owner account. */
  memberId?: string;
  exp: number;
};

/** The owner account, and anyone given the admin role. */
export const isAdmin = (session: AdminSession | null): boolean =>
  Boolean(session) && (session!.role ?? "admin") === "admin";

export const roleOf = (session: AdminSession | null): Role =>
  (session?.role ?? "admin") as Role;

/** What to call the person in the corner of the dashboard. */
export const displayName = (session: AdminSession | null): string =>
  session?.name?.trim() || session?.email || "";

/** Compare without leaking how much of the value matched. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do the work, so a wrong length is not measurably faster.
    let waste = 0;
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
      waste |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    }
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function adminConfigured(): boolean {
  return Boolean(
    process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD && secret(),
  );
}

/** Reasons the dashboard cannot be used, in plain words for the UI. */
export function adminSetupProblem(): string | null {
  if (!process.env.ADMIN_EMAIL) return "ADMIN_EMAIL is not set.";
  if (!process.env.ADMIN_PASSWORD) return "ADMIN_PASSWORD is not set.";
  if (!process.env.ADMIN_SESSION_SECRET)
    return "ADMIN_SESSION_SECRET is not set.";
  if (!secret())
    return "ADMIN_SESSION_SECRET is too short — use at least 16 characters.";
  return null;
}

export async function createSession(
  email: string,
  extra: { role?: Role; name?: string; memberId?: string } = {},
): Promise<string | null> {
  return sign(
    "admin-session",
    { email, role: extra.role ?? "admin", name: extra.name, memberId: extra.memberId },
    SESSION_DAYS * 24 * 60 * 60 * 1000,
  );
}

export async function readSession(
  token: string | undefined,
): Promise<AdminSession | null> {
  return verify<{ email: string; role?: Role; name?: string; memberId?: string }>(
    "admin-session",
    token,
  );
}

/** Checks a sign-in attempt against the configured credentials. */
export function credentialsMatch(email: string, password: string): boolean {
  const expectedEmail = process.env.ADMIN_EMAIL ?? "";
  const expectedPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!expectedEmail || !expectedPassword) return false;

  const emailOk = safeEqual(
    email.trim().toLowerCase(),
    expectedEmail.trim().toLowerCase(),
  );
  const passwordOk = safeEqual(password, expectedPassword);
  // Both are always evaluated, so a right email is not distinguishable.
  return emailOk && passwordOk;
}

export const sessionCookieOptions = cookieOptions;

export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;
