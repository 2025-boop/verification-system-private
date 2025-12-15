"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Circle, Database, Radio, Server } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface ComponentStatus {
  status: "ok" | "degraded" | "down" | "unknown"
  message?: string
}

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy" | "down"
  timestamp?: string
  components: {
    database: ComponentStatus
    redis: ComponentStatus
  }
  websocket: "ok" | "degraded" | "down"
}

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user?: {
    name: string
    email: string
  }
  websocketConnected?: boolean
}

const StatusBadge = ({ status }: { status: "ok" | "degraded" | "down" | "unknown" }) => {
  const colors = {
    ok: "text-green-500 bg-green-500/10",
    degraded: "text-yellow-500 bg-yellow-500/10",
    down: "text-red-500 bg-red-500/10",
    unknown: "text-gray-500 bg-gray-500/10",
  }

  const statusText = status === "ok" ? "Healthy" : status === "unknown" ? "Unknown" : status.charAt(0).toUpperCase() + status.slice(1)

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${colors[status]}`}>
      {status === "ok" && <CheckCircle2 className="w-4 h-4 inline mr-1" />}
      {(status === "degraded" || status === "down" || status === "unknown") && (
        <Circle className="w-4 h-4 inline mr-1" />
      )}
      {statusText}
    </span>
  )
}

export function SettingsDialog({
  open,
  onOpenChange,
  user,
  websocketConnected,
}: SettingsDialogProps) {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastChecked, setLastChecked] = useState<string>("")

  const fetchHealth = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/proxy/health")
      if (res.ok) {
        const data = await res.json()
        // Map backend response format to frontend state
        setHealth({
          status: data.status || "healthy",
          timestamp: data.timestamp,
          components: {
            database: data.components?.database || { status: "unknown" },
            redis: data.components?.redis || { status: "unknown" },
          },
          websocket: websocketConnected ? "ok" : "down",
        })
        setLastChecked(new Date().toLocaleTimeString())
      }
    } catch (error) {
      console.error("Failed to fetch health:", error)
      setHealth({
        status: "down",
        timestamp: new Date().toISOString(),
        components: {
          database: { status: "down" },
          redis: { status: "down" },
        },
        websocket: websocketConnected ? "ok" : "down",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      fetchHealth()
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Manage your preferences and system information</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="user" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="user">User</TabsTrigger>
            <TabsTrigger value="system">System Health</TabsTrigger>
          </TabsList>

          <TabsContent value="user" className="space-y-4 mt-4">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Name</label>
                <p className="text-sm font-medium mt-1">{user?.name || "Agent"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Email</label>
                <p className="text-sm font-medium mt-1">{user?.email || "agent@controlroom.local"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Role</label>
                <p className="text-sm font-medium mt-1">Agent</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="system" className="space-y-4 mt-4">
            <div className="space-y-4">
              {/* Overall Status */}
              {health && (
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Overall Status</span>
                    <StatusBadge
                      status={
                        health.status === "healthy"
                          ? "ok"
                          : health.status === "degraded"
                            ? "degraded"
                            : health.status === "unhealthy"
                              ? "down"
                              : "down"
                      }
                    />
                  </div>
                </div>
              )}

              {/* Backend (Django Server) */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Django Backend</span>
                </div>
                {health ? (
                  health.status !== "down" ? (
                    <StatusBadge status="ok" />
                  ) : (
                    <StatusBadge status="down" />
                  )
                ) : (
                  <span className="text-xs text-muted-foreground">Loading...</span>
                )}
              </div>

              {/* WebSocket */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">WebSocket Connection</span>
                </div>
                {health ? (
                  <StatusBadge status={health.websocket} />
                ) : (
                  <span className="text-xs text-muted-foreground">Loading...</span>
                )}
              </div>

              {/* Database */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Database</span>
                </div>
                {health ? (
                  <StatusBadge status={health.components.database.status} />
                ) : (
                  <span className="text-xs text-muted-foreground">Loading...</span>
                )}
              </div>

              {/* Redis */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Redis Cache</span>
                </div>
                {health ? (
                  <StatusBadge status={health.components.redis.status} />
                ) : (
                  <span className="text-xs text-muted-foreground">Loading...</span>
                )}
              </div>

              {/* Timestamp and Last Checked */}
              {lastChecked && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground text-center">
                    Checked at: {lastChecked}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
