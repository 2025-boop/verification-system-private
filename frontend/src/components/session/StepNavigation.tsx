"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, ArrowRight, Circle, AlertTriangle } from "lucide-react"
import { STAGES, STAGE_LABELS, STAGE_ORDER } from "@/lib/constants/sessions"

interface StepNavigationProps {
  currentStage: string
  viewingStage: string
  onStageClick: (stage: string) => void
}

export function StepNavigation({
  currentStage,
  viewingStage,
  onStageClick,
}: StepNavigationProps) {
  // Calculate which steps are completed
  const getStepStatus = (stage: string) => {
    const currentIndex =
      STAGE_ORDER[currentStage as keyof typeof STAGE_ORDER] || 0
    const stageIndex = STAGE_ORDER[stage as keyof typeof STAGE_ORDER] || 0

    if (stageIndex < currentIndex) {
      return "completed" // ✓ Done
    } else if (stage === currentStage) {
      return "current" // → Active
    } else {
      return "pending" // ○ Pending
    }
  }

  // Get icon for step status
  const getStepIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case "current":
        return <ArrowRight className="w-4 h-4 text-blue-500" />
      default:
        return <Circle className="w-4 h-4 text-muted-foreground" />
    }
  }

  // Count completed steps
  const completedCount = STAGES.filter(
    (stage) => getStepStatus(stage) === "completed"
  ).length

  return (
    <div className="space-y-3">
      {/* Progress Header */}
      <div className="px-2">
        <div className="text-xs font-medium text-muted-foreground mb-2">
          Progress
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold">{completedCount}</div>
          <div className="text-xs text-muted-foreground">of {STAGES.length}</div>
        </div>
        <div className="mt-2 w-full bg-muted rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all"
            style={{ width: `${(completedCount / STAGES.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Steps List */}
      <div className="space-y-1">
        {STAGES.map((stage) => {
          const status = getStepStatus(stage)
          const label = STAGE_LABELS[stage] || stage
          const isViewing = stage === viewingStage
          const isActive = stage === currentStage

          return (
            <Button
              key={stage}
              variant={isViewing ? "default" : isActive ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onStageClick(stage)}
              className="w-full justify-start gap-2 text-xs h-8"
              disabled={status === "pending" && stage !== currentStage}
              title={status === "pending" && stage !== currentStage ? "Not yet available" : ""}
            >
              {getStepIcon(status)}
              <span className="flex-1 text-left truncate">{label}</span>
              {status === "current" && !isActive && (
                <Badge variant="default" className="h-5 text-xs px-1 ml-auto">
                  Current
                </Badge>
              )}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
