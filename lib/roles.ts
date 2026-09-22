/**
 * Who may see what.
 *
 * Kept on its own, with no imports at all, because the middleware runs on
 * the edge and asks these questions on every request — it must not drag a
 * database client along with the answer.
 *
 * An **admin** sees the whole dashboard. A **coordinator** — the sub-admin —
 * works the requests and sends them out to merchants, and never sees a single
 * number about the business: no overview, no charts, no invoices, no totals.
 * A **marketer** never signs in at all.
 */

export const ROLES = ["admin", "coordinator", "marketer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  coordinator: "Coordinator",
  marketer: "Marketer",
};

export const ROLE_DETAIL: Record<Role, string> = {
  admin: "Everything: requests, merchants, invoices, the numbers and the team.",
  coordinator:
    "Requests only — work them and send them to merchants. No statistics, no invoices.",
  marketer:
    "Never signs in. A name, email and phone to assign merchants to, and to send the playbook and their work to.",
};

/**
 * Marketers work in the field and hear from us by email. They have no
 * reason to be inside the dashboard, so the role cannot carry a sign-in at
 * all — not merely "has no password yet".
 */
export const roleCanSignIn = (role: Role): boolean => role !== "marketer";

/** Short enough to type, long enough to matter. */
export const MIN_PASSWORD = 10;

/** Where a coordinator lands, and where they are sent back to. */
export const COORDINATOR_HOME = "/admin/requests";

/**
 * The single list that decides it, used by the middleware, the pages and the
 * API. Requests and nothing else — a coordinator's job is to work them and
 * get them out to merchants.
 */
export function coordinatorMayVisit(pathname: string): boolean {
  return (
    pathname === "/admin/requests" ||
    pathname.startsWith("/admin/requests/") ||
    pathname === "/admin/login"
  );
}

/** The dashboard's own navigation, filtered to what the role may open. */
export function roleNav(role: Role): { href: string; label: string }[] {
  const all = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/requests", label: "Requests" },
    { href: "/admin/vendors", label: "Merchants" },
    { href: "/admin/invoices", label: "Invoices" },
    { href: "/admin/marketers", label: "Marketers" },
    { href: "/admin/team", label: "Team" },
    { href: "/admin/diagnostics", label: "Diagnostics" },
  ];
  return role === "admin" ? all : all.filter((l) => coordinatorMayVisit(l.href));
}
