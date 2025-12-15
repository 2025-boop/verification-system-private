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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader, ChevronDown, AlertTriangle, Lock } from "lucide-react"
import { toast } from "sonner"
import { IconComponent } from "@/lib/icon-map"
import { STAFF_SESSION_ACTIONS, type SessionStatus } from "@/lib/constants/sessions"

interface SessionActionsDropdownProps {
  sessionId: string
  sessionStatus: SessionStatus
  isStaff?: boolean
  onActionComplete?: () => void
}

type SessionAction = "force-complete" | "mark-unsuccessful" | null

export function SessionActionsDropdown({
  sessionId,
  sessionStatus,
  isStaff = false,
  onActionComplete,
}: SessionActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [selectedAction, setSelectedAction] = useState<SessionAction>(null)
  const [reason, setReason] = useState("")
  const [comment, setComment] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Only show if staff and session is active
  const canPerformActions = isStaff && sessionStatus === "active"

  if (!canPerformActions) {
    return null
  }

  const handleActionClick = (action: SessionAction) => {
    setSelectedAction(action)
    setReason("")
    setComment("")
    setShowDialog(true)
    setIsOpen(false)
  }

  const handleExecuteAction = async () => {
    if (!selectedAction) return

    setIsLoading(true)
    try {
      const body: Record<string, any> = {}

      if (selectedAction === "force-complete") {
        if (reason) body.reason = reason
      } else if (selectedAction === "mark-unsuccessful") {
        if (reason) body.reason = reason
        if (comment) body.comment = comment
      }

      const res = await fetch(`/api/proxy/sessions/${sessionId}/actions/${selectedAction}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || `Failed to ${selectedAction}`)
      }

      const actionLabel =
        selectedAction === "force-complete" ? "Session force completed" : "Session marked unsuccessful"
      toast.success(`${actionLabel} successfully`, { duration: 3000 })
      setShowDialog(false)
      setSelectedAction(null)
      onActionComplete?.()
    } catch (err) {
      console.error("Action error:", err)
      const message = err instanceof Error ? err.message : "Action failed"
      toast.error("Action failed", {
        description: message,
        duration: 4000,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const actionConfig = STAFF_SESSION_ACTIONS.find((a) => a.action === selectedAction)
  const isDestructive = selectedAction === "mark-unsuccessful"

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            <Lock className="w-4 h-4" /> Actions <ChevronDown className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Staff Session Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            {STAFF_SESSION_ACTIONS.map((action) => (
              <DropdownMenuItem
                key={action.action}
                onClick={() => handleActionClick(action.action as SessionAction)}
                className={action.variant === "destructive" ? "text-red-600" : ""}
              >
                <IconComponent name={action.icon as any} className="w-4 h-4 mr-2" />
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Action Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{actionConfig?.label || "Session Action"}</DialogTitle>
            <DialogDescription>{actionConfig?.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Warning for destructive actions */}
            {isDestructive && (
              <Alert className="border-red-500/50 bg-red-500/5">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800 ml-2">
                  This action is <strong>PERMANENT</strong> and cannot be undone.
                  <br />
                  The session will be marked as failed and moved to terminal state.
                </AlertDescription>
              </Alert>
            )}

            {/* Reason Field */}
            <div className="space-y-2">
              <Label htmlFor="reason">
                Reason {!actionConfig?.requiresReason && "(optional)"}
              </Label>
              <Input
                id="reason"
                placeholder="e.g., Invalid credentials provided..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="text-sm"
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">Recorded in audit trail for compliance</p>
            </div>

            {/* Comment Field (only for mark-unsuccessful) */}
            {selectedAction === "mark-unsuccessful" && (
              <div className="space-y-2">
                <Label htmlFor="comment">Comment (optional)</Label>
                <Textarea
                  id="comment"
                  placeholder="Additional notes about why verification was unsuccessful..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  className="text-sm"
                  disabled={isLoading}
                />
              </div>
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
              onClick={handleExecuteAction}
              disabled={isLoading}
              variant={isDestructive ? "destructive" : "default"}
            >
              {isLoading ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                actionConfig?.label || "Execute"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
