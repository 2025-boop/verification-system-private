import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getBackendUrl } from "@/lib/api"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string }> }
) {
  try {
    const { id, templateId } = await params
    const cookieStore = await cookies()
    const access = cookieStore.get("access_token")?.value

    if (!access) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
    }

    // Fetch full template details (includes subject, html_body, plain_text_body)
    const backendUrl = getBackendUrl(
      `/api/companies/${id}/email-templates/${templateId}/`
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
        { error: errorData.detail || errorData.error || "Failed to fetch template" },
        { status: res.status }
      )
    }

    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data)
  } catch (e) {
    console.error("Template detail error:", e)
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    )
  }
}
