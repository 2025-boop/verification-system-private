import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getBackendUrl } from "@/lib/api"

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const access = cookieStore.get("access_token")?.value

    if (!access) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
    }

    const body = await req.json()
    const { uuids } = body

    if (!Array.isArray(uuids) || uuids.length === 0) {
      return NextResponse.json(
        { error: "Invalid request: uuids must be a non-empty array" },
        { status: 400 }
      )
    }

    // Call backend bulk delete endpoint
    const res = await fetch(getBackendUrl("/api/sessions/bulk-delete/"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uuids }),
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: "Backend request failed" },
        { status: res.status }
      )
    }

    // Parse and return the backend response with detailed results
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    console.error("Bulk delete error:", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
