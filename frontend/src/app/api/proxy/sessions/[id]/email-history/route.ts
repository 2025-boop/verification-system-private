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

    // Extract query parameters
    const { searchParams } = new URL(req.url)
    const queryString = searchParams.toString()

    // Call the backend endpoint
    const backendUrl = getBackendUrl(
      `/api/sessions/${id}/email-history/${queryString ? "?" + queryString : ""}`
    )
    const res = await fetch(backendUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${access}`,
      },
    })

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || errorData.error || "Failed to fetch email history" },
        { status: res.status }
      )
    }

    // Parse and return the backend response
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data)
  } catch (e) {
    console.error("Email history error:", e)
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    )
  }
}
