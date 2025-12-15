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

    // Fetch templates for this company (returns all active templates)
    // Frontend filters for verification_link type
    const backendUrl = getBackendUrl(`/api/companies/${id}/email-templates/`)
    const res = await fetch(backendUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${access}`,
      },
    })

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || errorData.error || "Failed to fetch templates" },
        { status: res.status }
      )
    }

    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data)
  } catch (e) {
    console.error("Templates list error:", e)
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    )
  }
}
