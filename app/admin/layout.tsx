import Link from "next/link";
import type { Metadata } from "next";
import { LogoMark } from "@/components/Logo";
import { currentSession } from "@/lib/admin-guard";
import { isAdmin, displayName } from "@/lib/admin-auth";
import { ROLE_LABEL, roleNav } from "@/lib/roles";
import { SignOut } from "./AdminUI";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  /*
   * The nav is built from the same rule the middleware enforces, so a
   * coordinator is never shown a door that is locked against them.
   */
  const session = await currentSession();
  const admin = isAdmin(session);
  const links = roleNav(admin ? "admin" : "coordinator");
  const who = displayName(session);

  return (
    <div className="min-h-[100svh] bg-bone-100">
      <header className="sticky top-0 z-30 border-b border-bone-200 bg-bone-100/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link
            href={admin ? "/admin" : "/admin/requests"}
            className="flex shrink-0 items-center gap-2"
          >
            <LogoMark className="h-7 w-7" />
            <span className="hidden font-display text-[17px] font-extrabold tracking-[-0.03em] text-ink-900 min-[420px]:inline">
              Spendbox
            </span>
            <span className="hidden rounded-full bg-bone-200 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink-500 sm:inline">
              {admin ? "Dashboard" : ROLE_LABEL.coordinator}
            </span>
          </Link>

          <nav className="no-bar ml-auto flex min-w-0 items-center gap-0.5 overflow-x-auto sm:gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="shrink-0 rounded-full px-3 py-2 text-[13.5px] font-semibold text-ink-500 transition-colors hover:bg-bone-200 hover:text-ink-900"
              >
                {l.label}
              </Link>
            ))}
            {who && (
              <span
                title={who}
                className="ml-1 hidden max-w-[18ch] shrink-0 truncate rounded-full bg-bone-200 px-3 py-1.5 text-[12.5px] font-semibold text-ink-500 lg:inline"
              >
                {who}
              </span>
            )}
            <SignOut />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
