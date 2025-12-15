import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getBackendUrl } from "@/lib/api"

export async function POST(
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

    // Get request body
    let body = {}
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      )
    }

    // Call the backend endpoint
    const backendUrl = getBackendUrl(`/api/sessions/${id}/send-email/`)
    const res = await fetch(backendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || errorData.error || "Failed to send email" },
        { status: res.status }
      )
    }

    // Parse and return the backend response
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    console.error("Send email error:", e)
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    )
  }
}
