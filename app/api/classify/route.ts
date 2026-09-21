import { NextResponse } from "next/server";
import { classify } from "@/lib/classify";
import { rateLimit, clientKey } from "@/lib/ratelimit";

export const runtime = "nodejs";

/**
 * Suggests categories for a request as it is being typed. Deliberately
 * forgiving: any failure returns an empty suggestion rather than an error,
 * because this only ever assists the person filling the form.
 */
export async function POST(request: Request) {
  const limit = rateLimit(`classify:${clientKey(request)}`, 60, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ categories: [], source: "none" });
  }

  let text = "";
  try {
    const body = (await request.json()) as { text?: unknown };
    if (typeof body.text === "string") text = body.text;
  } catch {
    return NextResponse.json({ categories: [], source: "none" });
  }

  if (text.trim().length < 8) {
    return NextResponse.json({ categories: [], source: "none" });
  }

  const result = await classify(text);
  return NextResponse.json(result);
}
