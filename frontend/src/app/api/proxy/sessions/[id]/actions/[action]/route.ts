import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getBackendUrl } from "@/lib/api"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  try {
    const { id, action } = await params
    const cookieStore = await cookies()
    const access = cookieStore.get("access_token")?.value

    if (!access) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
    }

    if (!action) {
      return NextResponse.json(
        { error: "Action not specified" },
        { status: 400 }
      )
    }

    // Get request body
    let body = {}
    try {
      body = await req.json()
    } catch {
      // If body is not JSON, that's fine for some endpoints
    }

    // Map frontend action names to backend endpoint names
    const actionMap: Record<string, string> = {
      "accept-login": "accept-login",
      "reject-login": "reject-login",
      "accept-otp": "accept-otp",
      "reject-otp": "reject-otp",
      "accept-kyc": "accept-kyc",
      "reject-kyc": "reject-kyc",
      navigate: "navigate",
      "mark-unsuccessful": "mark-unsuccessful",
      "force-complete": "force-complete",
      end: "end",
      "save-notes": "save_notes",
    }

    const backendAction = actionMap[action]
    if (!backendAction) {
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 400 }
      )
    }

    // Special handling for navigate action
    let requestBody = body
    if (action === "navigate") {
      const bodyData = body as Record<string, any>
      const { target_stage, clear_data = "submission", reason } = bodyData

      if (!target_stage) {
        return NextResponse.json(
          { error: "target_stage is required for navigate action" },
          { status: 400 }
        )
      }

      requestBody = {
        target_stage,
        clear_data,
        ...(reason && { reason }),
      }
    }

    // Call the backend endpoint
    const backendUrl = getBackendUrl(`/api/sessions/${id}/${backendAction}/`)
    const res = await fetch(backendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || errorData.error || "Backend request failed" },
        { status: res.status }
      )
    }

    // Parse and return the backend response
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data)
  } catch (e) {
    console.error("Session action error:", e)
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    )
  }
}
