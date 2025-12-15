"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader } from "lucide-react"
import { toast } from "sonner"
import { RejectDialog } from "./RejectDialog"
import { NavigationDropdown } from "./NavigationDropdown"
import { SessionActionsDropdown } from "./SessionActionsDropdown"
import { STAGE_ACTIONS, type SessionStage, type SessionStatus } from "@/lib/constants/sessions"

interface ActionBarProps {
  sessionId: string
  stage: string
  status?: SessionStatus
  isStaff?: boolean
  onActionComplete?: () => void
}

export function ActionBar({ sessionId, stage, status = "active", isStaff = false, onActionComplete }: ActionBarProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)

  const stageActions = STAGE_ACTIONS[stage as keyof typeof STAGE_ACTIONS]
  const sessionStatus = status as SessionStatus

  const handleApprove = async () => {
    if (!stageActions) return

    setIsLoading(true)
    try {
      const res = await fetch(`/api/proxy/sessions/${sessionId}/actions/${stageActions.approve}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to approve step")
      }

      toast.success("Step approved successfully", { duration: 3000 })
      onActionComplete?.()
    } catch (err) {
      console.error("Approve error:", err)
      const message = err instanceof Error ? err.message : "Failed to approve step"
      toast.error("Approval failed", {
        description: message,
        duration: 4000,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleReject = async (reason: string) => {
    if (!stageActions) return

    setIsLoading(true)
    try {
      const res = await fetch(`/api/proxy/sessions/${sessionId}/actions/${stageActions.reject}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to reject step")
      }

      toast.success("Step rejected successfully", { duration: 3000 })
      setShowRejectDialog(false)
      onActionComplete?.()
    } catch (err) {
      console.error("Reject error:", err)
      const message = err instanceof Error ? err.message : "Failed to reject step"
      toast.error("Rejection failed", {
        description: message,
        duration: 4000,
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Don't show action bar if no actions available for this stage
  if (!stageActions && stage === "completed") {
    return null
  }

  return (
    <>
      <div className="flex flex-wrap gap-3 justify-between items-center p-4 bg-muted border rounded-lg">
        <div className="flex flex-wrap gap-2">
          {stageActions && (
            <>
              <Button
                onClick={handleApprove}
                disabled={isLoading}
                className="gap-2"
                size="sm"
              >
                {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : null}
                Approve
              </Button>

              <Button
                onClick={() => setShowRejectDialog(true)}
                disabled={isLoading}
                variant="destructive"
                size="sm"
                className="gap-2"
              >
                {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : null}
                Reject
              </Button>
            </>
          )}

          {/* Navigation Dropdown */}
          <NavigationDropdown
            sessionId={sessionId}
            currentStage={stage as SessionStage}
            isStaff={isStaff}
            onNavigationComplete={onActionComplete}
          />

          {/* Session Actions Dropdown */}
          <SessionActionsDropdown
            sessionId={sessionId}
            sessionStatus={sessionStatus}
            isStaff={isStaff}
            onActionComplete={onActionComplete}
          />
        </div>

        {isLoading && (
          <span className="text-xs text-muted-foreground">Processing...</span>
        )}
      </div>

      <RejectDialog
        open={showRejectDialog}
        onOpenChange={setShowRejectDialog}
        onConfirm={handleReject}
        isLoading={isLoading}
        stage={stage}
      />
    </>
  )
}
