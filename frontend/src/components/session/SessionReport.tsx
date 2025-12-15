"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FileDown, FileText, Table2, Mail, Loader } from "lucide-react"
import { toast } from "sonner"

interface SessionReportProps {
  sessionId: string
  caseId: string
  stage: string
  status: string
  agent: string
  createdAt: string
  updatedAt: string
  notes?: string
  credentialsVerified?: boolean
  secretKeyVerified?: boolean
  kycStatus?: string
}

export function SessionReport({
  sessionId,
  caseId,
  stage,
  status,
  agent,
  createdAt,
  updatedAt,
  notes,
  credentialsVerified,
  secretKeyVerified,
  kycStatus,
}: SessionReportProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Generate CSV content
  const generateCSVContent = () => {
    const headers = ["Field", "Value"]
    const rows = [
      ["Session ID", sessionId],
      ["Case ID", caseId],
      ["Agent", agent],
      ["Stage", stage],
      ["Status", status],
      ["Created At", new Date(createdAt).toLocaleString()],
      ["Updated At", new Date(updatedAt).toLocaleString()],
      [""],
      ["Verification Status", ""],
      ["Credentials Verified", credentialsVerified ? "Yes" : "No"],
      ["Secret Key Verified", secretKeyVerified ? "Yes" : "No"],
      ["KYC Status", kycStatus || "Pending"],
      [""],
      ["Agent Notes", notes || "No notes"],
    ]

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n")

    return csvContent
  }

  // Generate plain text content
  const generateTextContent = () => {
    return `SESSION REPORT
=====================================

Session Information
-------------------
Session ID: ${sessionId}
Case ID: ${caseId}
Agent: ${agent}
Stage: ${stage}
Status: ${status}

Timeline
--------
Created: ${new Date(createdAt).toLocaleString()}
Updated: ${new Date(updatedAt).toLocaleString()}
Duration: ${getDuration()}

Verification Status
-------------------
Credentials: ${credentialsVerified ? "✓ Verified" : "✗ Not Verified"}
Secret Key: ${secretKeyVerified ? "✓ Verified" : "✗ Not Verified"}
KYC: ${kycStatus || "Pending"}

Agent Notes
-----------
${notes || "No notes recorded"}

=====================================
Generated: ${new Date().toLocaleString()}
`
  }

  // Calculate session duration
  const getDuration = () => {
    const start = new Date(createdAt)
    const end = new Date(updatedAt)
    const diffMs = end.getTime() - start.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 60) return `${diffMins} minutes`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ${diffMins % 60}m`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ${diffHours % 24}h`
  }

  // Export as CSV
  const handleExportCSV = async () => {
    try {
      setExporting(true)
      const csvContent = generateCSVContent()
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)

      link.setAttribute("href", url)
      link.setAttribute("download", `session-report-${caseId}-${Date.now()}.csv`)
      link.style.visibility = "hidden"

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success("Session report exported as CSV")
    } catch (error) {
      toast.error("Failed to export CSV")
    } finally {
      setExporting(false)
    }
  }

  // Export as TXT
  const handleExportText = async () => {
    try {
      setExporting(true)
      const textContent = generateTextContent()
      const blob = new Blob([textContent], { type: "text/plain;charset=utf-8;" })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)

      link.setAttribute("href", url)
      link.setAttribute("download", `session-report-${caseId}-${Date.now()}.txt`)
      link.style.visibility = "hidden"

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success("Session report exported as text")
    } catch (error) {
      toast.error("Failed to export text")
    } finally {
      setExporting(false)
    }
  }

  // Email report (placeholder - would integrate with backend)
  const handleEmailReport = async () => {
    try {
      setExporting(true)
      toast.info("Emailing report feature coming soon", { duration: 3000 })
    } catch (error) {
      toast.error("Failed to email report")
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      {/* Report Button Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Session Report</CardTitle>
          <CardDescription>Export and share session details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-2 p-3 bg-muted/30 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold">{stage}</div>
                <div className="text-xs text-muted-foreground mt-1">Current Stage</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{getDuration()}</div>
                <div className="text-xs text-muted-foreground mt-1">Duration</div>
              </div>
            </div>

            {/* Verification Status Summary */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Verification Status</div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={credentialsVerified ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"}>
                  {credentialsVerified ? "✓ Credentials" : "○ Credentials"}
                </Badge>
                <Badge variant="outline" className={secretKeyVerified ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"}>
                  {secretKeyVerified ? "✓ Secret Key" : "○ Secret Key"}
                </Badge>
                <Badge variant="outline" className={kycStatus === "verified" ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"}>
                  {kycStatus === "verified" ? "✓ KYC" : "○ KYC"}
                </Badge>
              </div>
            </div>

            {/* Export Options */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDialog(true)}
              className="w-full mt-2 gap-2"
              disabled={exporting}
            >
              <FileDown className="w-4 h-4" />
              {exporting ? "Exporting..." : "Export Report"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Export Options Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Export Session Report</DialogTitle>
            <DialogDescription>
              Choose a format to download the session report
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* CSV Export */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={exporting}
              className="w-full justify-start gap-2"
            >
              {exporting ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Table2 className="w-4 h-4" />
              )}
              Export as CSV
            </Button>

            {/* Text Export */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportText}
              disabled={exporting}
              className="w-full justify-start gap-2"
            >
              {exporting ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              Export as Text
            </Button>

            {/* Email Report (Coming Soon) */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleEmailReport}
              disabled={exporting || true}
              className="w-full justify-start gap-2 opacity-50"
              title="Coming soon"
            >
              {exporting ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
              Email Report (Coming Soon)
            </Button>
          </div>

          {/* Info Text */}
          <div className="p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground">
              The report includes session metadata, verification status, and agent notes. Timeline events can be exported separately from the Event Timeline panel.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
