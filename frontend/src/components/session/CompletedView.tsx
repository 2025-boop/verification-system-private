"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Download, XCircle } from "lucide-react"
import { toast } from "sonner"

interface CompletedViewProps {
  sessionId: string
  caseId: string
  status: string
  credentialsVerified: boolean
  secretKeyVerified: boolean
  kycStatus?: string
  onExport?: () => void
  onClose?: () => void
}

export function CompletedView({
  sessionId,
  caseId,
  status,
  credentialsVerified,
  secretKeyVerified,
  kycStatus,
  onExport,
  onClose,
}: CompletedViewProps) {
  const isCompleted = status === "completed"
  const isRejected = status === "terminated"

  return (
    <div className="space-y-6">
      {/* Success/Failure Banner */}
      <Card
        className={`border-2 ${
          isCompleted
            ? "border-green-500/30 bg-green-500/5"
            : "border-red-500/30 bg-red-500/5"
        }`}
      >
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            {isCompleted ? (
              <CheckCircle2 className="w-12 h-12 text-green-500 flex-shrink-0 mt-1" />
            ) : (
              <XCircle className="w-12 h-12 text-red-500 flex-shrink-0 mt-1" />
            )}

            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-2">
                {isCompleted ? "Session Completed" : "Session Terminated"}
              </h2>
              <p className="text-muted-foreground mb-4">
                {isCompleted
                  ? "All verification steps have been completed successfully. The user has been verified."
                  : "This session has been terminated. Verification was not completed."}
              </p>

              <Badge
                className={`text-sm px-3 py-1 ${
                  isCompleted
                    ? "bg-green-500/20 text-green-700 border-green-500/30"
                    : "bg-red-500/20 text-red-700 border-red-500/30"
                }`}
                variant="outline"
              >
                {isCompleted ? "Verified" : "Rejected"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Verification Summary */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">Verification Summary</h3>
          <div className="grid grid-cols-3 gap-4">
            {/* Credentials */}
            <div className="p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                {credentialsVerified ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className="font-medium text-sm">Credentials</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {credentialsVerified ? "Verified" : "Not verified"}
              </p>
            </div>

            {/* Secret Key */}
            <div className="p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                {secretKeyVerified ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className="font-medium text-sm">Secret Key</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {secretKeyVerified ? "Verified" : "Not verified"}
              </p>
            </div>

            {/* KYC */}
            <div className="p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                {kycStatus === "verified" ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className="font-medium text-sm">KYC</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {kycStatus === "verified" ? "Verified" : "Not verified"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session Details */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">Session Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <label className="text-muted-foreground">Case ID</label>
              <p className="font-mono font-medium mt-1">{caseId}</p>
            </div>
            <div>
              <label className="text-muted-foreground">Session ID</label>
              <p className="font-mono font-medium mt-1">{sessionId}</p>
            </div>
            <div>
              <label className="text-muted-foreground">Status</label>
              <p className="font-medium mt-1">
                {isCompleted ? "Completed" : "Terminated"}
              </p>
            </div>
            <div>
              <label className="text-muted-foreground">Completed At</label>
              <p className="font-medium mt-1">
                {new Date().toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button
          onClick={onExport}
          variant="outline"
          className="gap-2 flex-1"
        >
          <Download className="w-4 h-4" />
          Export Session Report
        </Button>
        <Button onClick={onClose} className="flex-1">
          Close Session
        </Button>
      </div>

      {/* Info Message */}
      <div className="p-4 bg-muted/50 rounded-lg border border-muted-foreground/20 text-sm text-muted-foreground">
        <p>
          💡 This session is now {isCompleted ? "completed" : "terminated"}. You can export the full session report for records and audit purposes.
        </p>
      </div>
    </div>
  )
}
