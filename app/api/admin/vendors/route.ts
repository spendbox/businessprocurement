import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, readSession } from "@/lib/admin-auth";
import { deleteVendor } from "@/lib/admin-data";

export const runtime = "nodejs";

/**
 * Removes a merchant for good.
 *
 * Behind the admin session, and the UI asks for a second click before it
 * calls this, because there is no undo — a deleted application is gone from
 * the database and from every future match.
 */
export async function DELETE(request: Request) {
  const session = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  }

  let id = "";
  try {
    const body = (await request.json()) as Record<string, unknown>;
    id = String(body.id ?? "");
  } catch {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }

  if (!id) {
    return NextResponse.json(
      { ok: false, message: "Which merchant?" },
      { status: 400 },
    );
  }

  const result = await deleteVendor(id);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: result.error ?? "Could not delete that merchant." },
      { status: 500 },
    );
  }

  console.log("[spendbox] merchant deleted", { id, company: result.company });

  return NextResponse.json({
    ok: true,
    message: `${result.company ?? "Merchant"} deleted.`,
  });
}
