import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getBackendUrl } from "@/lib/api";

const DJANGO_REFRESH = getBackendUrl("/api/auth/token/refresh/");

function cookie(name: string, value: string, maxAge: number) {
  const secure = process.env.NODE_ENV === "production";
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; ${secure ? "Secure; " : ""
    }`;
}

export async function POST() {
  try {
    const cookiesList = await cookies();
    const refreshToken = cookiesList.get("refresh_token")?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { ok: false, message: "Missing refresh token" },
        { status: 401 }
      );
    }

    // Call Django to refresh access token
    const response = await fetch(DJANGO_REFRESH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, message: "Refresh failed" },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (!data.access) {
      return NextResponse.json(
        { ok: false, message: "No access token returned" },
        { status: 500 }
      );
    }

    const res = NextResponse.json({ ok: true });

    // Set new access token (12 hours)
    res.headers.append("Set-Cookie", cookie("access_token", data.access, 60 * 60 * 12));

    return res;
  } catch (err) {
    console.error("Refresh error", err);
    return NextResponse.json(
      { ok: false, message: "Server error" },
      { status: 500 }
    );
  }
}
