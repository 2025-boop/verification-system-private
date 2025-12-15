"use client"
import React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { AlertCircle, Check } from "lucide-react"
import { StageActions } from "./StageActions"
import { CopyButton } from "@/components/common/CopyButton"

interface CredentialsData {
  username?: string
  password?: string
  verified_at?: string
  verified_by?: string
}

interface CurrentSubmission {
  stage: string
  data?: Record<string, any>
}

interface CredentialsTabProps {
  credentials?: CredentialsData | null
  currentSubmission?: CurrentSubmission | null
  stage: string
  sessionId?: string
  onActionComplete?: () => void
}


export function CredentialsTab({
  credentials,
  currentSubmission,
  stage,
  sessionId,
  onActionComplete,
}: CredentialsTabProps) {
  const isVerified = !!credentials?.verified_at

  // Single unified status variable (eliminates multiple render paths)
  const credentialStatus = React.useMemo(() => {
    if (isVerified) return "verified"

    if (currentSubmission?.stage === "credentials" &&
        currentSubmission?.data &&
        Object.keys(currentSubmission.data).length > 0 &&
        (currentSubmission.data.username || currentSubmission.data.password)) {
      return "pending"
    }

    return "awaiting"
  }, [isVerified, currentSubmission])

  // Single return with conditional content (prevents unmount/remount flashing)
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Login Credentials</span>
            {credentialStatus === "verified" && (
              <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
                <Check className="w-3 h-3 mr-1" />
                Verified
              </Badge>
            )}
            {credentialStatus === "pending" && (
              <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                Pending Review
              </Badge>
            )}
            {credentialStatus === "awaiting" && (
              <Badge variant="outline" className="bg-gray-500/20 text-gray-400 border-gray-500/30">
                Awaiting User
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {credentialStatus === "pending" && "User has submitted their login credentials awaiting agent review"}
            {credentialStatus !== "pending" && "User provided login credentials for verification"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Pending submission section */}
          {credentialStatus === "pending" && (
            <>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Username / Email</label>
                  <div className="mt-2 p-3 bg-muted rounded-md border flex items-center justify-between">
                    <p className="font-mono text-sm flex-1">{currentSubmission?.data?.username || "N/A"}</p>
                    {currentSubmission?.data?.username && <CopyButton value={currentSubmission.data.username} label="Username" />}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Password</label>
                  <div className="mt-2 p-3 bg-muted rounded-md border flex items-center justify-between">
                    <p className="font-mono text-sm flex-1">{currentSubmission?.data?.password || "N/A"}</p>
                    {currentSubmission?.data?.password && <CopyButton value={currentSubmission.data.password} label="Password" />}
                  </div>
                </div>
              </div>

              <Separator />

              <Alert className="border-yellow-500/50 bg-yellow-500/5">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  User has submitted their credentials. Review above and use Accept/Reject buttons to proceed.
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
          {credentialStatus === "verified" && (
            <>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Username / Email</label>
                  <div className="mt-2 p-3 bg-muted rounded-md border flex items-center justify-between">
                    <p className="font-mono text-sm flex-1">{credentials?.username || "N/A"}</p>
                    {credentials?.username && <CopyButton value={credentials.username} label="Username" />}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Password</label>
                  <div className="mt-2 p-3 bg-muted rounded-md border flex items-center justify-between">
                    <p className="font-mono text-sm flex-1">{credentials?.password || "N/A"}</p>
                    {credentials?.password && <CopyButton value={credentials.password} label="Password" />}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4 p-3 bg-green-500/5 border border-green-500/20 rounded-lg">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Verified By</label>
                  <p className="text-sm mt-1 font-semibold">{credentials?.verified_by || "System"}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Verified At</label>
                  <p className="text-sm mt-1">
                    {credentials?.verified_at
                      ? new Date(credentials.verified_at).toLocaleDateString("en-US", {
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
          {credentialStatus === "awaiting" && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>No credentials data available yet. User has not entered their login credentials.</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
