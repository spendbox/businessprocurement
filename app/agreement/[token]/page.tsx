import type { Metadata } from "next";
import { LogoMark } from "@/components/Logo";
import { agreementBodyHtml, getAgreement, readSigningToken } from "@/lib/agreements";
import { SignForm } from "./SignForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your agreement",
  robots: { index: false, follow: false },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100svh] bg-bone-100">
      <header className="border-b border-bone-200 bg-bone-100">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-2.5 px-4 sm:px-6">
          <LogoMark className="h-7 w-7" />
          <span className="font-display text-[17px] font-extrabold tracking-[-0.03em] text-ink-900">Spendbox</span>
        </div>
      </header>
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">{children}</main>
    </div>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Shell>
      <div className="rounded-2xl border border-bone-200 bg-white p-7">
        <h1 className="font-display text-[24px] font-bold tracking-[-0.02em] text-ink-900">{title}</h1>
        <div className="mt-2 text-[15px] leading-relaxed text-ink-500">{children}</div>
      </div>
    </Shell>
  );
}

/**
 * Where a merchant reads and signs their agreement. Public, because the
 * link in their email is the permission — it is signed, it names one
 * agreement, and it expires.
 */
export default async function AgreementPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const id = await readSigningToken(decodeURIComponent(token));
  if (!id) {
    return (
      <Notice title="This link has expired">
        Signing links last 30 days. Reply to the email it came in and we will send you a fresh one.
      </Notice>
    );
  }

  const agreement = await getAgreement(id);
  if (!agreement) {
    return <Notice title="Agreement not found">It may have been withdrawn. Reply to the email it came in and we will sort it out.</Notice>;
  }
  if (agreement.status === "void") {
    return (
      <Notice title="This agreement was withdrawn">
        Spendbox has replaced or withdrawn it, so it can no longer be signed. You will receive the current one by email.
      </Notice>
    );
  }

  return (
    <Shell>
      <div>
        <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-forest-600">
          {agreement.status === "signed" ? "Signed agreement" : "Agreement to sign"} · {agreement.reference}
        </p>
        <p className="mt-1 text-[14.5px] text-ink-400">
          For {agreement.vendor_company}, sent to {agreement.vendor_email}
        </p>
      </div>

      <article
        className="rounded-2xl border border-bone-200 bg-white p-6 sm:p-9"
        /* Rendered by lib/doc-render, which escapes every character first. */
        dangerouslySetInnerHTML={{ __html: agreementBodyHtml(agreement) }}
      />

      {agreement.status === "sent" ? (
        <SignForm token={decodeURIComponent(token)} company={agreement.vendor_company} contact={agreement.vendor_contact} />
      ) : (
        <p className="rounded-2xl border-[1.5px] border-forest-500 bg-forest-50 px-5 py-4 text-[15px] font-semibold text-forest-700">
          This agreement is signed. A copy was emailed to {agreement.vendor_email}.
        </p>
      )}
    </Shell>
  );
}
