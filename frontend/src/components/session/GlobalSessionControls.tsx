"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"
import { IconComponent } from "@/lib/icon-map"
import { NavigationDropdown } from "./NavigationDropdown"
import { SessionActionsDropdown } from "./SessionActionsDropdown"
import { TerminateDialog } from "./TerminateDialog"
import { TERMINATE_ACTION, type SessionStage, type SessionStatus } from "@/lib/constants/sessions"

interface GlobalSessionControlsProps {
  sessionId: string
  currentStage: SessionStage
  sessionStatus: SessionStatus
  isStaff?: boolean
  onActionComplete?: () => void
  variant?: "bar" | "inline"
}

export function GlobalSessionControls({
  sessionId,
  currentStage,
  sessionStatus,
  isStaff = false,
  onActionComplete,
  variant = "bar",
}: GlobalSessionControlsProps) {
  const [showTerminateDialog, setShowTerminateDialog] = useState(false)

  const containerClassName = variant === "inline"
    ? "flex items-center gap-1.5"
    : "flex flex-wrap gap-2 p-4 bg-muted/50 border rounded-lg"

  return (
    <>
      <div className={containerClassName}>
        {/* Terminate Session (Always visible for staff) */}
        {isStaff && (
          <Button
            variant="destructive"
            size={variant === "inline" ? "sm" : "sm"}
            onClick={() => setShowTerminateDialog(true)}
            className={variant === "inline" ? "gap-1" : "gap-2"}
            title="Stop session immediately (sets status='terminated')"
          >
            <IconComponent name={TERMINATE_ACTION.icon as any} className="w-4 h-4" />
            {variant !== "inline" && TERMINATE_ACTION.label}
          </Button>
        )}

        {/* Navigation Dropdown */}
        <NavigationDropdown
          sessionId={sessionId}
          currentStage={currentStage}
          isStaff={isStaff}
          onNavigationComplete={onActionComplete}
        />

        {/* Session Actions Dropdown */}
        <SessionActionsDropdown
          sessionId={sessionId}
          sessionStatus={sessionStatus}
          isStaff={isStaff}
          onActionComplete={onActionComplete}
        />
      </div>

      {/* Terminate Dialog */}
      <TerminateDialog
        open={showTerminateDialog}
        onOpenChange={setShowTerminateDialog}
        sessionId={sessionId}
        onTerminateComplete={onActionComplete}
      />
    </>
  )
}
