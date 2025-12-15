"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader } from "lucide-react"
import { toast } from "sonner"
import { RejectDialog } from "./RejectDialog"
import { AdvancedStageActions } from "./AdvancedStageActions"
import { STAGE_ACTIONS, type SessionStage } from "@/lib/constants/sessions"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDown } from "lucide-react"

interface StageActionBarProps {
  sessionId: string
  stage: string
  onActionComplete?: () => void
}

export function StageActionBar({
  sessionId,
  stage,
  onActionComplete,
}: StageActionBarProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const stageActions = STAGE_ACTIONS[stage as keyof typeof STAGE_ACTIONS]

  // Don't show if no actions for this stage
  if (!stageActions) {
    return null
  }

  const handleApprove = async () => {
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

  return (
    <>
      <div className="space-y-4 p-4 bg-muted/30 border rounded-lg">
        {/* Primary Actions */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Primary Actions</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleApprove}
              disabled={isLoading}
              className="gap-2"
              size="sm"
              variant="default"
            >
              {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : <span>✅</span>}
              Accept
            </Button>

            <Button
              onClick={() => setShowRejectDialog(true)}
              disabled={isLoading}
              variant="destructive"
              size="sm"
              className="gap-2"
            >
              {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : <span>❌</span>}
              Reject
            </Button>
          </div>
        </div>

        {/* Advanced Actions (Collapsible) */}
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between px-2 h-8 text-xs font-medium"
            >
              <span>Advanced Actions</span>
              <ChevronDown
                className="w-4 h-4 transition-transform"
                style={{
                  transform: showAdvanced ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-2">
            <AdvancedStageActions
              sessionId={sessionId}
              stage={stage as SessionStage}
              onActionComplete={onActionComplete}
            />
          </CollapsibleContent>
        </Collapsible>
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
