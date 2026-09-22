import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, readSession } from "@/lib/admin-auth";
import { getInvoice } from "@/lib/admin-data";
import { invoiceDocument, invoiceFilename } from "@/lib/invoices";

export const runtime = "nodejs";

/**
 * The invoice as a document.
 *
 * Opened in a tab it shows a Print button — the browser's own "Save as PDF"
 * turns it into the PDF a buyer expects, on every platform, with nothing
 * extra installed. With ?download it comes down as a file instead.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;

  let invoice;
  try {
    invoice = await getInvoice(id);
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Not available." },
      { status: 503 },
    );
  }

  if (!invoice) {
    return NextResponse.json({ ok: false, message: "Invoice not found." }, { status: 404 });
  }

  const download = new URL(request.url).searchParams.has("download");
  const html = invoiceDocument(invoice, { showPrintButton: !download });

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${invoiceFilename(
        invoice,
      )}"`,
    },
  });
}
