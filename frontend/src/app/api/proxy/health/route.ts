import { NextResponse } from "next/server"
import { getBackendUrl } from "@/lib/api"

export async function GET() {
  try {
    // Health check endpoint is public - no authentication required
    const res = await fetch(getBackendUrl("/api/health/"))

    if (res.ok) {
      const data = await res.json()
      // Map backend response to frontend format
      return NextResponse.json({
        status: data.status || "healthy",
        timestamp: data.timestamp,
        components: {
          database: data.components?.database || { status: "unknown" },
          redis: data.components?.redis || { status: "unknown" },
        },
      })
    } else {
      // Backend responded with error
      return NextResponse.json({
        status: "degraded",
        timestamp: new Date().toISOString(),
        components: {
          database: { status: "unknown" },
          redis: { status: "unknown" },
        },
      })
    }
  } catch (error) {
    // Backend is unreachable
    console.error("Health check error:", error)
    return NextResponse.json({
      status: "down",
      timestamp: new Date().toISOString(),
      components: {
        database: { status: "down" },
        redis: { status: "down" },
      },
    })
  }
}
