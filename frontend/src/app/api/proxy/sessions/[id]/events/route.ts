import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getBackendUrl } from "@/lib/api"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const access = cookieStore.get("access_token")?.value

    if (!access) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
    }

    // Get query parameters for filtering
    const url = new URL(req.url)
    const limit = url.searchParams.get("limit") || "50"
    const offset = url.searchParams.get("offset") || "0"
    const category = url.searchParams.get("category")

    // Build backend URL with query parameters
    const backendUrl = new URL(getBackendUrl(`/api/sessions/${id}/logs/`))
    backendUrl.searchParams.append("limit", limit)
    backendUrl.searchParams.append("offset", offset)
    if (category) {
      backendUrl.searchParams.append("category", category)
    }

    // Call backend endpoint
    const res = await fetch(backendUrl.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${access}`,
        "Content-Type": "application/json",
      },
    })

    if (!res.ok) {
      // If 404, backend doesn't have logs endpoint yet - return empty array
      if (res.status === 404) {
        return NextResponse.json({
          results: [],
          count: 0,
          message: "Event logs not available yet. Backend endpoint not implemented.",
        })
      }

      const errorData = await res.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || errorData.error || "Backend request failed" },
        { status: res.status }
      )
    }

    // Parse and return the backend response
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    console.error("Session events error:", e)
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    )
  }
}
