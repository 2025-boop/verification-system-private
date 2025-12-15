"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { AlertCircle, Check, Phone } from "lucide-react"

interface CaseIdTabProps {
  caseId: string
  userOnline: boolean
  createdAt: string
  sessionId: string
}

export function CaseIdTab({ caseId, userOnline, createdAt, sessionId }: CaseIdTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Session Information</span>
            {userOnline ? (
              <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
                <Check className="w-3 h-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">
                <AlertCircle className="w-3 h-3 mr-1" />
                Disconnected
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Case identification and user connection status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Connection Status Alert */}
          {userOnline ? (
            <Alert className="border-green-500/50 bg-green-500/5">
              <Phone className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                User is connected and ready. Guide them through the verification process in real-time.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-red-500/50 bg-red-500/5">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                User is currently offline. They will reconnect when they return to the session.
              </AlertDescription>
            </Alert>
          )}

          <Separator />

          {/* Case ID Display */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Case ID</label>
            <div className="p-4 bg-muted rounded-lg border font-mono text-lg tracking-widest break-all">{caseId}</div>
            <p className="text-xs text-muted-foreground">This ID uniquely identifies this verification session</p>
          </div>

          <Separator />

          {/* Session Details */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Session ID</label>
              <div className="mt-2 p-3 bg-muted rounded-md border font-mono text-xs break-all">{sessionId}</div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Session Started</label>
              <p className="text-sm mt-1">
                {new Date(createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>

          <Separator />

          {/* Agent Guidance */}
          <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg space-y-2">
            <h4 className="font-semibold text-sm text-blue-900">Your Role</h4>
            <p className="text-sm text-blue-800">
              You are on a real-time call with the user. Guide them through each verification stage:
            </p>
            <ol className="text-sm text-blue-800 list-decimal list-inside space-y-1">
              <li>User enters login credentials</li>
              <li>User provides their secret key/OTP</li>
              <li>User completes KYC verification</li>
            </ol>
            <p className="text-xs text-blue-700 mt-2">Review and approve/reject each stage as the user completes it.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
