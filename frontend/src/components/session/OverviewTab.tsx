"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

interface OverviewTabProps {
  caseId: string
  sessionId: string
  agent: string
  stage: string
  status: string
  userOnline: boolean
  createdAt: string
  updatedAt: string
}

export function OverviewTab({
  caseId,
  sessionId,
  agent,
  stage,
  status,
  userOnline,
  createdAt,
  updatedAt,
}: OverviewTabProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Session Information</CardTitle>
          <CardDescription>Basic details about this verification session</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Case ID</label>
              <p className="text-lg font-semibold mt-2">{caseId}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Session ID (UUID)</label>
              <p className="text-sm font-mono mt-2 break-all">{sessionId}</p>
            </div>
          </div>

          <Separator />

          {/* Row 2 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Assigned Agent</label>
              <p className="text-lg font-semibold mt-2">{agent}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Current Stage</label>
              <p className="text-lg font-semibold mt-2">{stage}</p>
            </div>
          </div>

          <Separator />

          {/* Row 3 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <div className="mt-2">
                <Badge variant="outline">{status}</Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">User Status</label>
              <div className="flex items-center gap-2 mt-2">
                <span className={`w-2 h-2 rounded-full ${userOnline ? "bg-green-500" : "bg-red-500"}`} />
                <span className="font-medium">{userOnline ? "Online" : "Offline"}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Row 4 - Timestamps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Created At</label>
              <p className="text-sm mt-2">{formatDate(createdAt)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
              <p className="text-sm mt-2">{formatDate(updatedAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TODO: Add additional metadata when available from backend
        - IP Address
        - Device Type / Browser
        - Geo-location
        - Risk Score
        - Attempt Counter
      */}
    </div>
  )
}
