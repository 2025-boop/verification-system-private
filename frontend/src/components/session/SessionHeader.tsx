"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { CopyButton } from "@/components/common/CopyButton"
import { STATUS_COLORS, STATUS_LABELS, STAGE_LABELS, type SessionStage, type SessionStatus } from "@/lib/constants/sessions"
import { GlobalSessionControls } from "./GlobalSessionControls"

interface SessionHeaderProps {
  sessionId: string
  caseId: string
  stage: string
  status: "active" | "completed" | "terminated"
  userOnline: boolean
  createdAt: string
  agent: string
  isStaff?: boolean
  onActionComplete?: () => void
}

export function SessionHeader({
  sessionId,
  caseId,
  stage,
  status,
  userOnline,
  createdAt,
  agent,
  isStaff = false,
  onActionComplete,
}: SessionHeaderProps) {
  const [elapsedTime, setElapsedTime] = useState("00:00:00")

  // Calculate elapsed time
  useEffect(() => {
    const startTime = new Date(createdAt).getTime()

    const updateTimer = () => {
      const now = new Date().getTime()
      const elapsed = Math.floor((now - startTime) / 1000)

      const hours = Math.floor(elapsed / 3600)
      const minutes = Math.floor((elapsed % 3600) / 60)
      const seconds = elapsed % 60

      const formatted = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      setElapsedTime(formatted)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [createdAt])

  return (
    <div className="space-y-4">
      {/* Top bar with back button and basic info */}
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/dashboard/sessions">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </Link>

        <div className="flex items-center gap-3 flex-1 min-w-fit">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Case {caseId}</h1>
              {caseId && <CopyButton value={caseId} label="Case ID" />}
            </div>
            <p className="text-xs text-muted-foreground">{sessionId}</p>
          </div>
        </div>

        <Badge variant="outline" className={STATUS_COLORS[status]}>
          {STATUS_LABELS[status]}
        </Badge>

        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="font-mono">{elapsedTime}</span>
        </div>

        <Badge variant="secondary">Agent: {agent}</Badge>

        {/* Session Controls (inline) */}
        {isStaff && (
          <div className="ml-auto flex-shrink-0">
            <GlobalSessionControls
              sessionId={sessionId}
              currentStage={stage as SessionStage}
              sessionStatus={status as SessionStatus}
              isStaff={isStaff}
              onActionComplete={onActionComplete}
              variant="inline"
            />
          </div>
        )}
      </div>

      <Separator />

      {/* Secondary info bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Current Step:</span>
            <Badge variant="outline">{STAGE_LABELS[stage as keyof typeof STAGE_LABELS] || stage}</Badge>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">User Status:</span>
            <div className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${userOnline ? "bg-green-500" : "bg-red-500"}`} />
              <span className="text-sm">{userOnline ? "Online" : "Offline"}</span>
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Created: {new Date(createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  )
}
