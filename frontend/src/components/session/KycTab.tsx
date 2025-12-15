"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { AlertCircle, Check, ExternalLink } from "lucide-react"
import { StageActions } from "./StageActions"

interface CurrentSubmission {
  stage: string
  data?: Record<string, any>
}

interface VerifiedKyc {
  status?: string
  verified_at?: string
  verified_by?: string
}

interface KycTabProps {
  stage: string
  sessionId: string
  kycProvider?: string
  currentSubmission?: CurrentSubmission | null
  verifiedKyc?: VerifiedKyc | null
  onActionComplete?: () => void
}

export function KycTab({
  stage,
  sessionId,
  kycProvider = "Persona",
  currentSubmission,
  verifiedKyc,
  onActionComplete,
}: KycTabProps) {
  const isCurrentStage = stage === "kyc"
  const isVerified = !!verifiedKyc?.status

  // Determine KYC status based on submission and verification data
  const kycStatus =
    isVerified
      ? "verified"
      : currentSubmission?.stage === "kyc" && currentSubmission?.data?.status === "submitted"
        ? "submitted"
        : currentSubmission?.stage === "kyc" && currentSubmission?.data?.status === "started"
          ? "started"
          : isCurrentStage
            ? "not_started"
            : "not_reached"

  const startedAt = currentSubmission?.data?.started_at
  const submittedAt = currentSubmission?.data?.submitted_at

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>KYC Verification</span>
            {/* Status Badge - Shows different states */}
            {kycStatus === "verified" && (
              <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
                <Check className="w-3 h-3 mr-1" />
                Verified
              </Badge>
            )}
            {kycStatus === "submitted" && (
              <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                Pending Review
              </Badge>
            )}
            {kycStatus === "started" && (
              <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                In Progress
              </Badge>
            )}
            {kycStatus === "not_started" && (
              <Badge variant="outline" className="bg-gray-500/20 text-gray-400 border-gray-500/30">
                Awaiting User
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Know Your Customer verification process</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* KYC Workflow Info */}
          <div className="space-y-4 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
            <h4 className="font-semibold text-sm">How KYC Works</h4>
            <ol className="space-y-2 text-sm">
              <li className="flex gap-2">
                <span className="font-semibold min-w-fit">1.</span>
                <span>User is redirected to {kycProvider} verification portal</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold min-w-fit">2.</span>
                <span>User uploads government-issued ID (front & back)</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold min-w-fit">3.</span>
                <span>User takes a selfie for face verification</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold min-w-fit">4.</span>
                <span>{kycProvider} performs OCR and face matching</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold min-w-fit">5.</span>
                <span>Agent reviews KYC results and makes decision</span>
              </li>
            </ol>
          </div>

          <Separator />

          {/* Provider Info */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">KYC Provider</label>
            <div className="mt-2 flex items-center justify-between p-3 bg-muted rounded-md border">
              <span className="font-semibold">{kycProvider}</span>
              <Badge variant="secondary">3rd Party</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              All document processing and face matching is handled by {kycProvider}, not by our system.
            </p>
          </div>

          <Separator />

          {/* Current Status - Dynamic based on KYC status */}
          <div className="space-y-4">
            {/* Status: Not Reached */}
            {kycStatus === "not_reached" && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>User has not yet reached the KYC stage.</AlertDescription>
              </Alert>
            )}

            {/* Status: Awaiting User to Start */}
            {kycStatus === "not_started" && (
              <Alert className="border-gray-500/50 bg-gray-500/5">
                <AlertCircle className="h-4 w-4 text-gray-600" />
                <AlertDescription className="text-gray-800">
                  Waiting for user to begin KYC verification. User will need to click "Begin KYC" to proceed.
                </AlertDescription>
              </Alert>
            )}

            {/* Status: In Progress (User started KYC) */}
            {kycStatus === "started" && (
              <>
                <Alert className="border-blue-500/50 bg-blue-500/5">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    User has started KYC verification and may be undergoing verification with {kycProvider}.
                    Waiting for user to complete and return.
                  </AlertDescription>
                </Alert>

                <div className="p-3 bg-muted rounded-lg border space-y-2">
                  <p className="text-sm font-medium">Started At</p>
                  <p className="text-xs">
                    {startedAt
                      ? new Date(startedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </p>
                </div>

                <div className="p-3 bg-muted rounded-lg border space-y-2">
                  <p className="text-sm font-medium">Session ID for {kycProvider}</p>
                  <p className="text-xs font-mono">{sessionId}</p>
                  <p className="text-xs text-muted-foreground">
                    Use this ID to track the verification in {kycProvider} portal.
                  </p>
                </div>

                <Button variant="outline" className="w-full gap-2">
                  <ExternalLink className="w-4 h-4" />
                  View in {kycProvider} Portal
                </Button>
              </>
            )}

            {/* Status: Submitted (Ready for Agent Review) */}
            {kycStatus === "submitted" && (
              <>
                <Alert className="border-yellow-500/50 bg-yellow-500/5">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">
                    User has completed KYC verification and submitted their results. Review the submission and approve or reject below.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <div className="p-3 bg-muted rounded-lg border space-y-2">
                    <p className="text-sm font-medium">Submitted At</p>
                    <p className="text-xs">
                      {submittedAt
                        ? new Date(submittedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Status: Verified (Approved) */}
            {kycStatus === "verified" && (
              <div className="space-y-4 p-3 bg-green-500/5 border border-green-500/20 rounded-lg">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-green-900">✓ KYC Approved</h4>
                  <p className="text-sm text-green-800">
                    User has successfully completed KYC verification and been approved.
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-green-500/20">
                  <div>
                    <label className="text-xs font-medium text-green-900">Verified By</label>
                    <p className="text-sm mt-1">{verifiedKyc?.verified_by || "System"}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-green-900">Verified At</label>
                    <p className="text-sm mt-1">
                      {verifiedKyc?.verified_at
                        ? new Date(verifiedKyc.verified_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Inline Stage Actions - Only show when KYC submitted and ready for approval */}
          {kycStatus === "submitted" && (
            <>
              <Separator />
              <StageActions
                sessionId={sessionId}
                stage={stage}
                onActionComplete={onActionComplete}
                variant="inline"
              />
            </>
          )}

          {/* TODO: When backend provides KYC endpoints
            - Fetch KYC status from {kycProvider}
            - Display OCR results (document data)
            - Show face match score
            - Display document validation issues
            - Show liveness detection results
            - Allow agent to view document images
            - Integration with /api/sessions/{uuid}/kyc/ endpoint
          */}
        </CardContent>
      </Card>
    </div>
  )
}
