/**
 * Signed, self-contained tokens.
 *
 * Nothing is stored server side: a token is its own payload plus an HMAC of
 * that payload, so it cannot be altered without the secret. Every token
 * carries a `purpose`, which is mixed into the signature — a sign-in link
 * can therefore never be replayed as a session cookie, or vice versa, even
 * though both are signed with the same key.
 *
 * Built on Web Crypto so the same code runs in middleware and in routes.
 */

export type Purpose =
  | "admin-session"
  | "portal-session"
  | "portal-login"
  | "agreement-sign";

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

/**
 * One secret covers everything, kept apart by purpose. Reusing
 * ADMIN_SESSION_SECRET rather than adding a second variable keeps setup to
 * one value; rotating it signs everyone out, which is the point of it.
 */
export function secret(): string | null {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value || value.length < 16) return null;
  return value;
}

async function key(purpose: Purpose): Promise<CryptoKey | null> {
  const value = secret();
  if (!value) return null;
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${purpose}:${value}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function sign<T extends object>(
  purpose: Purpose,
  payload: T,
  ttlMs: number,
): Promise<string | null> {
  const signingKey = await key(purpose);
  if (!signingKey) return null;
  const body = b64urlEncode(
    new TextEncoder().encode(JSON.stringify({ ...payload, exp: Date.now() + ttlMs })),
  );
  const mac = await crypto.subtle.sign("HMAC", signingKey, new TextEncoder().encode(body));
  return `${body}.${b64urlEncode(new Uint8Array(mac))}`;
}

export async function verify<T>(
  purpose: Purpose,
  token: string | undefined,
): Promise<(T & { exp: number }) | null> {
  if (!token) return null;
  const signingKey = await key(purpose);
  if (!signingKey) return null;

  const [body, mac] = token.split(".");
  if (!body || !mac) return null;

  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      signingKey,
      b64urlDecode(mac) as unknown as ArrayBuffer,
      new TextEncoder().encode(body),
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as T & {
      exp: number;
    };
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export const cookieOptions = (maxAgeSeconds: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: maxAgeSeconds,
});
