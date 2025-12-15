"use client"

import { useState } from "react"
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Loader, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

interface TerminateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
  onTerminateComplete?: () => void
}

export function TerminateDialog({
  open,
  onOpenChange,
  sessionId,
  onTerminateComplete,
}: TerminateDialogProps) {
  const [reason, setReason] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleTerminate = async () => {
    if (!reason.trim()) {
      toast.error("Please provide a reason for terminating the session")
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`/api/proxy/sessions/${sessionId}/actions/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to terminate session")
      }

      toast.success("Session terminated successfully", { duration: 3000 })
      setReason("")
      onOpenChange(false)
      onTerminateComplete?.()
    } catch (err) {
      console.error("Terminate error:", err)
      const message = err instanceof Error ? err.message : "Failed to terminate session"
      toast.error("Termination failed", {
        description: message,
        duration: 4000,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Terminate Session</DialogTitle>
          <DialogDescription>Stop this session immediately</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning Alert */}
          <Alert className="border-red-500/50 bg-red-500/5">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800 ml-2">
              This action will immediately stop the session and set status to{" "}
              <strong>'terminated'</strong>. The user will be disconnected.
            </AlertDescription>
          </Alert>

          {/* Reason Field (Required) */}
          <div className="space-y-2">
            <Label htmlFor="terminate-reason">Reason (Required)</Label>
            <Textarea
              id="terminate-reason"
              placeholder="e.g., User left the session, technical issue, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="text-sm"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              This reason will be recorded in the audit trail for compliance
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Keep Session Active
          </Button>
          <Button
            onClick={handleTerminate}
            disabled={isLoading || !reason.trim()}
            variant="destructive"
          >
            {isLoading ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Terminating...
              </>
            ) : (
              "Terminate Session"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
