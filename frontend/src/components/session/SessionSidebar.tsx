"use client"

import { StepNavigation } from "./StepNavigation"
import { SessionMetadata } from "./SessionMetadata"

interface SessionSidebarProps {
  currentStage: string
  viewingStage: string
  onStageClick: (stage: string) => void
  sessionId: string
}

export function SessionSidebar({
  currentStage,
  viewingStage,
  onStageClick,
  sessionId,
}: SessionSidebarProps) {
  return (
    <>
      {/* Sidebar Container */}
      <div className="w-64 border-r bg-muted/30 flex flex-col sticky top-[60px] h-[calc(100vh-60px)] overflow-hidden">
        {/* Content Area - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Step Navigation */}
          <div>
            <StepNavigation
              currentStage={currentStage}
              viewingStage={viewingStage}
              onStageClick={onStageClick}
            />
          </div>

          {/* Session Metadata */}
          <div>
            <SessionMetadata sessionId={sessionId} />
          </div>
        </div>
      </div>
    </>
  )
}
