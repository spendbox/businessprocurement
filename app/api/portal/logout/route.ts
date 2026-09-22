import { NextResponse } from "next/server";
import { PORTAL_COOKIE } from "@/lib/portal-auth";
import { cookieOptions } from "@/lib/signing";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(PORTAL_COOKIE, "", cookieOptions(0));
  return response;
}
