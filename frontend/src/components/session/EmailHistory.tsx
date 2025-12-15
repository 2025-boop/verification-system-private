"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Mail, Loader } from "lucide-react"
import { useEmailHistory } from "@/lib/hooks/useEmail"
import type { EmailLogData } from "@/lib/stores/sessionStore"

interface EmailHistoryProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
  emailLogs?: EmailLogData[]
}

export function EmailHistory({ open, onOpenChange, sessionId, emailLogs }: EmailHistoryProps) {
  const { history, loading, fetchHistory } = useEmailHistory()
  const [expanded, setExpanded] = useState<number | null>(null)

  // Fetch history when sheet opens
  useEffect(() => {
    if (open) {
      fetchHistory(sessionId)
    }
  }, [open, sessionId, fetchHistory])

  // Use provided emailLogs or fetched history
  const emails = emailLogs || history?.emails || []
  const isEmpty = !loading && emails.length === 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[500px] max-h-screen overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Email History
          </SheetTitle>
          <SheetDescription>
            All emails sent for this session ({emails.length})
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-2">
          {loading && (
            <div className="flex justify-center py-8">
              <Loader className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {isEmpty && (
            <div className="text-center py-8">
              <Mail className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No emails sent yet</p>
            </div>
          )}

          {emails.map((email) => (
            <div
              key={email.id}
              className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setExpanded(expanded === email.id ? null : email.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{email.to_email}</p>
                  <p className="text-xs text-muted-foreground truncate">{email.subject}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <StatusBadge status={email.status} />
                    <span className="text-xs text-muted-foreground">
                      {formatDate(email.created_at)}
                    </span>
                  </div>
                </div>
                <div>
                  {email.status === "queued" && (
                    <Loader className="w-4 h-4 animate-spin text-blue-500" />
                  )}
                  {email.status === "sent" && (
                    <div className="w-4 h-4 rounded-full bg-green-500" />
                  )}
                  {email.status === "failed" && (
                    <div className="w-4 h-4 rounded-full bg-red-500" />
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {expanded === email.id && (
                <div className="mt-4 pt-4 border-t space-y-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">To:</span>
                    <p className="font-mono text-xs break-all">{email.to_email}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Subject:</span>
                    <p>{email.subject}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Template:</span>
                    <p>{email.template_name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <p>
                      <StatusBadge status={email.status} />
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Sent:</span>
                    <p>{email.sent_at ? formatDate(email.sent_at) : "Not sent yet"}</p>
                  </div>
                  {email.error_message && (
                    <div className="bg-red-50 dark:bg-red-950 p-2 rounded">
                      <span className="text-muted-foreground">Error:</span>
                      <p className="text-red-600 dark:text-red-400">{email.error_message}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function StatusBadge({ status }: { status: string }) {
  const variants = {
    queued: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
    sent: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
    failed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  }

  const labels = {
    queued: "⏳ Queued",
    sent: "✅ Sent",
    failed: "❌ Failed",
  }

  const variant = variants[status as keyof typeof variants] || variants.queued
  const label = labels[status as keyof typeof labels] || status

  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${variant}`}>
      {label}
    </span>
  )
}

function formatDate(dateString: string) {
  try {
    const date = new Date(dateString)
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return dateString
  }
}
