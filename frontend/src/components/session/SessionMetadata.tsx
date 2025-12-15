"use client"

import { Globe, Smartphone, Clock, Network } from "lucide-react"
import { CopyButton } from "@/components/common/CopyButton"

interface SessionMetadataProps {
  sessionId: string
  ipAddress?: string
  deviceType?: string
  browser?: string
  geoLocation?: string
  userAgent?: string
}

export function SessionMetadata({
  sessionId,
  ipAddress = "192.168.1.100",
  deviceType = "Desktop",
  browser = "Chrome 120",
  geoLocation = "United States, California",
  userAgent,
}: SessionMetadataProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-muted-foreground px-2 uppercase tracking-wide">
        Session Details
      </h3>

      {/* Location & Network */}
      <div className="bg-card border border-border/50 rounded-lg p-3 space-y-2">
        <div className="flex items-start gap-3">
          <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-0.5">Location & IP</p>
            <p className="text-sm font-medium truncate">{geoLocation}</p>
            <p className="text-xs text-muted-foreground font-mono mt-1">{ipAddress}</p>
          </div>
        </div>
      </div>

      {/* Device & Browser */}
      <div className="bg-card border border-border/50 rounded-lg p-3 space-y-2">
        <div className="flex items-start gap-3">
          <Smartphone className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-0.5">Device</p>
            <p className="text-sm font-medium">{deviceType}</p>
            <p className="text-xs text-muted-foreground mt-1">{browser}</p>
          </div>
        </div>
      </div>

      {/* Connection */}
      <div className="bg-card border border-border/50 rounded-lg p-3 space-y-2">
        <div className="flex items-start gap-3">
          <Network className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-0.5">Status</p>
            <p className="text-sm font-medium text-green-600">Active/Typing</p>
            <p className="text-xs text-muted-foreground mt-1">Connected/Offline</p>
          </div>
        </div>
      </div>

      {/* Session ID */}
      <div className="bg-muted/30 border border-border/30 rounded-lg p-2.5">
        <p className="text-xs text-muted-foreground mb-1">Session ID</p>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-mono text-foreground break-all flex-1">{sessionId.substring(0, 16)}...</p>
          <CopyButton value={sessionId} label="Session ID" />
        </div>
      </div>
    </div>
  )
}
