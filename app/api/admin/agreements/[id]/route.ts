import { NextResponse } from "next/server";
import { guardApi } from "@/lib/admin-guard";
import { agreementDocument, agreementFilename, getAgreement } from "@/lib/agreements";

export const runtime = "nodejs";

/** The agreement as a document — opened to print, or ?download to save. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await guardApi("admin");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const agreement = await getAgreement(id);
  if (!agreement) {
    return NextResponse.json({ ok: false, message: "Agreement not found." }, { status: 404 });
  }

  const download = new URL(request.url).searchParams.has("download");
  return new NextResponse(agreementDocument(agreement, { printButton: !download }), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${agreementFilename(
        agreement,
      )}"`,
    },
  });
}
