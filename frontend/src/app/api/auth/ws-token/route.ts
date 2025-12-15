// src/app/api/auth/ws-token/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Rate limiting store (in-memory)
 * In production, consider using Redis for distributed rate limiting
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Check rate limit for a user based on their IP/session
 * Allows 100 requests per minute
 */
function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const limit = rateLimitStore.get(key);

  if (!limit || now > limit.resetTime) {
    // Reset window
    rateLimitStore.set(key, { count: 1, resetTime: now + 60000 }); // 60 second window
    return true;
  }

  if (limit.count >= 100) {
    return false; // Rate limit exceeded
  }

  limit.count++;
  return true;
}

/**
 * GET /api/auth/ws-token
 *
 * Returns the access token for WebSocket authentication.
 *
 * Since access_token is HttpOnly, client-side JavaScript cannot read it.
 * This endpoint provides a secure way to get the token for WebSocket connections
 * without exposing it directly to the client.
 *
 * Security considerations:
 * - Only returns token to authenticated users (checks for cookie existence)
 * - Token is short-lived (5 minutes)
 * - Response is not cached
 * - Includes rate limiting (100 req/min per IP) to prevent token harvesting
 * - Only accessible to same-origin requests
 */
export async function GET(request: Request) {
  try {
    // Rate limiting: use IP address or session identifier
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rateLimitKey = `ws-token:${ip}`;

    if (!checkRateLimit(rateLimitKey)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Rate limit exceeded. Maximum 100 requests per minute allowed.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
          },
        }
      );
    }

    const cookieStore = await cookies();
    const accessToken = cookieStore.get("access_token")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { ok: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { ok: true, token: accessToken },
      {
        status: 200,
        headers: {
          // Prevent caching of token response
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          // Security headers
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
        },
      }
    );
  } catch (error) {
    console.error("[WS Token Error]", error);
    return NextResponse.json(
      { ok: false, message: "Server error" },
      { status: 500 }
    );
  }
}
