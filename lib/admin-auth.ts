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

export const SESSION_COOKIE = "spendbox_admin";
const SESSION_DAYS = 7;

export type AdminSession = { email: string; exp: number };

function b64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

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

function secret(): string | null {
  const value = process.env.ADMIN_SESSION_SECRET;
  // A short secret is worse than none, because it looks configured.
  if (!value || value.length < 16) return null;
  return value;
}

async function key(): Promise<CryptoKey | null> {
  const value = secret();
  if (!value) return null;
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(value),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
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
  const signingKey = await key();
  if (!signingKey) return null;

  const payload: AdminSession = {
    email,
    exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
  const body = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const mac = await crypto.subtle.sign(
    "HMAC",
    signingKey,
    new TextEncoder().encode(body),
  );
  return `${body}.${b64urlEncode(new Uint8Array(mac))}`;
}

export async function readSession(token: string | undefined): Promise<AdminSession | null> {
  if (!token) return null;
  const signingKey = await key();
  if (!signingKey) return null;

  const [body, mac] = token.split(".");
  if (!body || !mac) return null;

  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      signingKey,
      b64urlDecode(mac) as unknown as ArrayBuffer,
      new TextEncoder().encode(body),
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  try {
    const session = JSON.parse(
      new TextDecoder().decode(b64urlDecode(body)),
    ) as AdminSession;
    if (typeof session.exp !== "number" || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
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

export const sessionCookieOptions = (maxAgeSeconds: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: maxAgeSeconds,
});

export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;
