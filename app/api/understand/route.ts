import { NextResponse } from "next/server";
import { understand } from "@/lib/understand";
import { rateLimit, clientKey } from "@/lib/ratelimit";

export const runtime = "nodejs";

/**
 * Structures a request as it is being written. Never errors at the caller —
 * an empty reading just means the form shows nothing yet.
 */
export async function POST(request: Request) {
  const limit = rateLimit(`understand:${clientKey(request)}`, 60, 60_000);
  const nothing = NextResponse.json({
    categories: [], quantity: "", budget: "", region: "", city: "",
    urgency: "", summary: "", source: "local",
  });
  if (!limit.ok) return nothing;

  let text = "";
  try {
    const body = (await request.json()) as { text?: unknown };
    if (typeof body.text === "string") text = body.text;
  } catch {
    return nothing;
  }
  if (text.trim().length < 12) return nothing;

  return NextResponse.json(await understand(text));
}
