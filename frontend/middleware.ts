/**
 * Middleware for protecting authenticated routes.
 *
 * This runs BEFORE Next.js serves a page or API route and acts as the
 * "edge gatekeeper" for your application. It does NOT validate tokens,
 * refresh tokens, or fetch data — it only decides whether a user
 * should be allowed to continue or be redirected to /login.
 *
 * Why so minimal?
 *   - Next.js recommends middleware be lightweight since it runs on the Edge.
 *   - Token refresh logic belongs in API routes (server-side), not here.
 *   - This ensures the app stays fast and avoids calling Django from the edge.
 *
 * Behavior:
 *   - If the user visits a protected route (/dashboard or subpages)
 *     AND does not have *any* auth cookies → redirect to /login.
 *
 *   - If the user has either:
 *       • access cookie, or
 *       • refresh cookie
 *     then we allow the request through.
 *
 *     If access is expired, the server route (/api/auth/refresh) will handle
 *     refreshing automatically — NOT the middleware.
 *
 * This file defines the boundary between "public pages" and "authenticated pages".
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  // Extract JWT cookies (if present)
  const access = req.cookies.get("access_token")?.value;
  const refresh = req.cookies.get("refresh_token")?.value;

  // The requested URL (we may modify it for redirects)
  const url = req.nextUrl;

  /**
   * PROTECTED ROUTES
   *
   * Any route under /dashboard requires authentication.
   * Add more protected paths here if needed.
   */
  if (url.pathname.startsWith("/dashboard")) {

    /**
     * Case 1 — User has NO tokens:
     *   - They are logged out OR cookies expired.
     *   - Redirect them to /login.
     */
    if (!access && !refresh) {
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    /**
     * Case 2 — User has access or refresh cookies:
     *   - Allow them through.
     *   - If access expired, your server-side fetch logic will refresh it.
     */
    return NextResponse.next();
  }

  // All other routes are public
  return NextResponse.next();
}

/**
 * Middleware Config
 *
 * "matcher" tells Next.js which routes should run through middleware.
 * This ensures we only protect what we intend to protect.
 *
 * - "/dashboard"           (exact match)
 * - "/dashboard/:path*"    (any sub-route)
 */
export const config = {
  matcher: [
    "/dashboard/:path*",

  ],
};
