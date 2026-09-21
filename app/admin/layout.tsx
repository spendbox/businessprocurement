import Link from "next/link";
import type { Metadata } from "next";
import { LogoMark } from "@/components/Logo";
import { SignOut } from "./AdminUI";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100svh] bg-bone-100">
      <header className="sticky top-0 z-30 border-b border-bone-200 bg-bone-100/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link href="/admin" className="flex shrink-0 items-center gap-2">
            <LogoMark className="h-7 w-7" />
            <span className="hidden font-display text-[17px] font-extrabold tracking-[-0.03em] text-ink-900 min-[420px]:inline">
              Spendbox
            </span>
            <span className="hidden rounded-full bg-bone-200 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink-500 sm:inline">
              Dashboard
            </span>
          </Link>

          <nav className="no-bar ml-auto flex min-w-0 items-center gap-0.5 overflow-x-auto sm:gap-1">
            {[
              { href: "/admin", label: "Overview" },
              { href: "/admin/requests", label: "Requests" },
              { href: "/admin/vendors", label: "Merchants" },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="shrink-0 rounded-full px-3 py-2 text-[13.5px] font-semibold text-ink-500 transition-colors hover:bg-bone-200 hover:text-ink-900"
              >
                {l.label}
              </Link>
            ))}
            <SignOut />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
