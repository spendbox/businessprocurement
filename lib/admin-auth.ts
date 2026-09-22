/**
 * Admin sign-in.
 *
 * The credentials live in environment variables, so changing who can get in
 * is a Vercel settings change and a redeploy — no user table, no password
 * reset flow, no extra service to run. That is the right trade for a
 * single-operator back office.
 *
 * The session is a cookie carrying a payload and an HMAC of that payload.
 * Nothing is stored server-side, and the cookie cannot be forged without
 * ADMIN_SESSION_SECRET. Built on Web Crypto so the same code runs in
 * middleware (edge) and in route handlers (node).
 */

import { cookieOptions, secret, sign, verify } from "./signing";

export const SESSION_COOKIE = "spendbox_admin";
const SESSION_DAYS = 7;

export type AdminSession = { email: string; exp: number };

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

export async function createSession(email: string): Promise<string | null> {
  return sign("admin-session", { email }, SESSION_DAYS * 24 * 60 * 60 * 1000);
}

export async function readSession(
  token: string | undefined,
): Promise<AdminSession | null> {
  return verify<{ email: string }>("admin-session", token);
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
