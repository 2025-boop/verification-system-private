// src/app/api/auth/login/route.ts — exchange credentials → Django, set cookies.
import { NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/api";

const DJANGO_LOGIN = getBackendUrl("/api/auth/login/");

/**
 * Helper to create cookie options consistently
 */
function cookieOptions(name: string, value: string, maxAgeSeconds: number) {
  const secure = process.env.NODE_ENV === "production";
  // Set SameSite=lax so link navigations still work while protecting from CSRF for most cases
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}; ${secure ? "Secure; " : ""
    }`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // Expect { username, password } from client
    const { username } = body;

    const resp = await fetch(DJANGO_LOGIN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      return NextResponse.json(
        { ok: false, message: err.detail || err || "Invalid credentials" },
        { status: resp.status }
      );
    }

    const data = await resp.json(); // { access, refresh }

    if (!data.access || !data.refresh) {
      return NextResponse.json(
        { ok: false, message: "Django did not return tokens" },
        { status: 500 }
      );
    }

    // Cookies: refresh_token = long-lived, access_token = short-lived (now 12h for stability)
    const refreshCookie = cookieOptions("refresh_token", data.refresh, 60 * 60 * 24 * 7); // 7 days
    const accessCookie = cookieOptions("access_token", data.access, 60 * 60 * 12); // 12 hours

    const res = NextResponse.json({ ok: true, message: "Logged in" }, { status: 200 });
    // Set cookies via response headers
    res.headers.append("Set-Cookie", refreshCookie);
    res.headers.append("Set-Cookie", accessCookie);

    // Store username in a readable cookie for avatar generation
    const usernameCookie = `username=${username}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}; ${process.env.NODE_ENV === "production" ? "Secure; " : ""
      }`;
    res.headers.append("Set-Cookie", usernameCookie);

    return res;
  } catch (err: any) {
    console.error("Login error:", err);
    return NextResponse.json({ ok: false, message: "Internal error" }, { status: 500 });
  }
}
