"use client"

import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

interface RejectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => void
  isLoading?: boolean
  stage: string
}

const REJECTION_REASONS: Record<string, string[]> = {
  credentials: [
    "Invalid credentials format",
    "Credentials failed validation",
    "Suspicious account activity",
    "Account locked or disabled",
    "Other (specify below)",
  ],
  secret_key: [
    "Incorrect secret key",
    "Code expired",
    "Multiple failed attempts",
    "Code mismatch",
    "Other (specify below)",
  ],
  kyc: [
    "Documents unclear or blurry",
    "Expired identification",
    "Face does not match document",
    "Suspicious document",
    "Other (specify below)",
  ],
}

export function RejectDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
  stage,
}: RejectDialogProps) {
  const [selectedReason, setSelectedReason] = useState("")
  const [customReason, setCustomReason] = useState("")

  const reasons = REJECTION_REASONS[stage] || []
  const isOtherSelected = selectedReason === reasons[reasons.length - 1]

  const handleConfirm = () => {
    const finalReason = isOtherSelected && customReason ? customReason : selectedReason
    if (finalReason) {
      onConfirm(finalReason)
      setSelectedReason("")
      setCustomReason("")
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Reject Step</AlertDialogTitle>
          <AlertDialogDescription>
            Provide a reason for rejecting this step. The user will need to retry.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Reason for Rejection</Label>
            <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
              {reasons.map((reason) => (
                <div key={reason} className="flex items-center space-x-2">
                  <RadioGroupItem value={reason} id={reason} />
                  <Label htmlFor={reason} className="font-normal cursor-pointer">
                    {reason}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {isOtherSelected && (
            <div className="space-y-2">
              <Label htmlFor="custom-reason" className="text-sm">
                Please specify:
              </Label>
              <Textarea
                id="custom-reason"
                placeholder="Enter your custom reason..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="min-h-20 resize-none"
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading || !selectedReason || (isOtherSelected && !customReason)}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? "Rejecting..." : "Reject"}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
