// src/app/api/proxy/sessions/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getBackendUrl } from "@/lib/api";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const access = cookieStore.get("access_token")?.value;

    if (!access) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const res = await fetch(
      getBackendUrl(`/api/sessions/${id}/`),
      {
        headers: {
          Authorization: `Bearer ${access}`,
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
  } catch (e) {
    console.error("Proxy error:", e);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const access = cookieStore.get("access_token")?.value;

    if (!access) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const res = await fetch(
      getBackendUrl(`/api/sessions/${id}/`),
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${access}`,
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "Backend request failed" },
        { status: res.status }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error("Proxy error:", e);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
