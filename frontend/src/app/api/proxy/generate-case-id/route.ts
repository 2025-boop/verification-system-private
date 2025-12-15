import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getBackendUrl } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const access = cookieStore.get("access_token")?.value;

    if (!access) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Forward request to Django
    const res = await fetch(
      getBackendUrl("/api/generate-case-id/"),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "Backend request failed" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
