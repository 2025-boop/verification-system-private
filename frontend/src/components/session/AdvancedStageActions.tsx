"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Loader, ChevronDown } from "lucide-react"
import { toast } from "sonner"
import { STAGE_LABELS, VALID_STAGE_TRANSITIONS, type SessionStage } from "@/lib/constants/sessions"

interface AdvancedStageActionsProps {
  sessionId: string
  stage: SessionStage
  onActionComplete?: () => void
}

type ActionType = "accept-skip" | "reject-send" | null

export function AdvancedStageActions({
  sessionId,
  stage,
  onActionComplete,
}: AdvancedStageActionsProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [selectedAction, setSelectedAction] = useState<ActionType>(null)
  const [targetStage, setTargetStage] = useState<SessionStage | null>(null)
  const [reason, setReason] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const validTargets = VALID_STAGE_TRANSITIONS[stage] || []

  // Only show if there are valid targets
  if (validTargets.length === 0) {
    return null
  }

  const handleActionClick = (action: ActionType, stage: SessionStage) => {
    setSelectedAction(action)
    setTargetStage(stage)
    setReason("")
    setShowDialog(true)
  }

  const handleExecute = async () => {
    if (!selectedAction || !targetStage) return

    setIsLoading(true)
    try {
      if (selectedAction === "accept-skip") {
        // Step 1: Accept current stage
        const acceptRes = await fetch(
          `/api/proxy/sessions/${sessionId}/actions/${getAcceptAction(stage)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          }
        )

        if (!acceptRes.ok) {
          const errorData = await acceptRes.json()
          throw new Error(errorData.error || "Failed to accept step")
        }

        // Step 2: Navigate to target stage
        const navigateRes = await fetch(
          `/api/proxy/sessions/${sessionId}/actions/navigate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              target_stage: targetStage,
              clear_data: "none",
            }),
          }
        )

        if (!navigateRes.ok) {
          const errorData = await navigateRes.json()
          throw new Error(errorData.error || "Failed to navigate")
        }

        toast.success(`Accepted and skipped to ${STAGE_LABELS[targetStage]}`, {
          duration: 3000,
        })
      } else if (selectedAction === "reject-send") {
        // Step 1: Reject current stage
        const rejectRes = await fetch(
          `/api/proxy/sessions/${sessionId}/actions/${getRejectAction(stage)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: reason || undefined }),
          }
        )

        if (!rejectRes.ok) {
          const errorData = await rejectRes.json()
          throw new Error(errorData.error || "Failed to reject step")
        }

        // Step 2: Navigate to target stage
        const navigateRes = await fetch(
          `/api/proxy/sessions/${sessionId}/actions/navigate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              target_stage: targetStage,
              clear_data: "all",
              reason: reason ? `Rejected: ${reason}` : undefined,
            }),
          }
        )

        if (!navigateRes.ok) {
          const errorData = await navigateRes.json()
          throw new Error(errorData.error || "Failed to navigate")
        }

        toast.success(`Rejected and sent to ${STAGE_LABELS[targetStage]}`, {
          duration: 3000,
        })
      }

      setShowDialog(false)
      setSelectedAction(null)
      setTargetStage(null)
      onActionComplete?.()
    } catch (err) {
      console.error("Advanced action error:", err)
      const message = err instanceof Error ? err.message : "Action failed"
      toast.error("Action failed", {
        description: message,
        duration: 4000,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {/* Accept & Skip To... */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              Accept & Skip to... <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Skip to Stage</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {validTargets.map((targetStg) => (
                <DropdownMenuItem
                  key={targetStg}
                  onClick={() => handleActionClick("accept-skip", targetStg)}
                >
                  {STAGE_LABELS[targetStg]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Reject & Send To... */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              Reject & Send to... <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Send to Stage</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {validTargets.map((targetStg) => (
                <DropdownMenuItem
                  key={targetStg}
                  onClick={() => handleActionClick("reject-send", targetStg)}
                >
                  {STAGE_LABELS[targetStg]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedAction === "accept-skip" ? "Accept & Skip" : "Reject & Send"}
            </DialogTitle>
            <DialogDescription>
              {selectedAction === "accept-skip"
                ? `Accept current stage and skip to ${targetStage ? STAGE_LABELS[targetStage] : ""}`
                : `Reject current stage and send user to ${targetStage ? STAGE_LABELS[targetStage] : ""}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedAction === "reject-send" && (
              <div className="space-y-2">
                <Label htmlFor="reject-reason">Reason (Optional)</Label>
                <Textarea
                  id="reject-reason"
                  placeholder="Why are you rejecting this submission?"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="text-sm"
                  disabled={isLoading}
                />
              </div>
            )}

            {selectedAction === "accept-skip" && (
              <p className="text-sm text-muted-foreground">
                This will accept the current submission and move the user directly to{" "}
                <strong>{targetStage ? STAGE_LABELS[targetStage] : ""}</strong>, skipping any
                intermediate stages.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExecute}
              disabled={isLoading}
              variant={selectedAction === "reject-send" ? "destructive" : "default"}
            >
              {isLoading ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : selectedAction === "accept-skip" ? (
                "Accept & Skip"
              ) : (
                "Reject & Send"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Helper functions to get action endpoints based on stage
function getAcceptAction(stage: SessionStage): string {
  const actionMap: Record<SessionStage, string> = {
    case_id: "accept-login", // Shouldn't happen, but fallback
    credentials: "accept-login",
    secret_key: "accept-otp",
    kyc: "accept-kyc",
    completed: "accept-login", // Shouldn't happen
  }
  return actionMap[stage]
}

function getRejectAction(stage: SessionStage): string {
  const actionMap: Record<SessionStage, string> = {
    case_id: "reject-login", // Shouldn't happen, but fallback
    credentials: "reject-login",
    secret_key: "reject-otp",
    kyc: "reject-kyc",
    completed: "reject-login", // Shouldn't happen
  }
  return actionMap[stage]
}
