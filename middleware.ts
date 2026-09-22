import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSession } from "@/lib/admin-auth";
import { PORTAL_COOKIE, readPortalSession } from "@/lib/portal-auth";
import { portalEnabled } from "@/lib/features";

/**
 * Gate the whole dashboard at the edge, so an unauthenticated request never
 * reaches a page that would query the database.
 */
/**
 * Middleware redirects must carry an absolute URL — Next parses the Location
 * itself and a relative one throws. Cloning nextUrl keeps the incoming host.
 * (The sign-in verification route uses a relative redirect instead, because
 * there a host mismatch would drop the cookie it has just set.)
 */
function redirectTo(request: NextRequest, path: string) {
  const url = request.nextUrl.clone();
  const [pathname, search = ""] = path.split("?");
  url.pathname = pathname;
  url.search = search;
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /* The business / merchant portal. Signing in is optional, but the pages
     behind it only ever show one verified address's own rows. */
  if (pathname.startsWith("/portal")) {
    // Switched off for now — let the pages return their own 404.
    if (!portalEnabled()) return NextResponse.next();

    // The login page and the link-verification route must stay reachable.
    if (pathname === "/portal/login" || pathname === "/portal/verify") {
      return NextResponse.next();
    }
    const portal = await readPortalSession(request.cookies.get(PORTAL_COOKIE)?.value);
    if (!portal) return redirectTo(request, "/portal/login");
    return NextResponse.next();
  }

  const session = await readSession(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/admin/login") {
    if (session) {
      return redirectTo(request, "/admin");
    }
    return NextResponse.next();
  }

  if (!session) {
    const next = pathname !== "/admin" ? `?next=${encodeURIComponent(pathname)}` : "";
    return redirectTo(request, `/admin/login${next}`);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/portal", "/portal/:path*"],
};
