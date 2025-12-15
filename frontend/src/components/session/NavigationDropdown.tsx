"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader, ChevronDown, Lock } from "lucide-react"
import { toast } from "sonner"
import { IconComponent } from "@/lib/icon-map"
import {
  STAGE_NAVIGATION,
  VALID_STAGE_TRANSITIONS,
  STAFF_NAVIGATION_ACTIONS,
  CLEAR_DATA_MODES,
  type SessionStage,
} from "@/lib/constants/sessions"
import type { SessionStatus } from "@/lib/constants/sessions"

interface NavigationDropdownProps {
  sessionId: string
  currentStage: SessionStage
  isStaff?: boolean
  onNavigationComplete?: () => void
}

export function NavigationDropdown({
  sessionId,
  currentStage,
  isStaff = false,
  onNavigationComplete,
}: NavigationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [selectedNavigation, setSelectedNavigation] = useState<{
    label: string
    targetStage: SessionStage
    clearData?: "submission" | "all" | "none"
  } | null>(null)
  const [clearDataMode, setClearDataMode] = useState<"submission" | "all" | "none">(
    selectedNavigation?.clearData || "submission"
  )
  const [reason, setReason] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const stageActions = STAGE_NAVIGATION[currentStage] || []
  const validTransitions = VALID_STAGE_TRANSITIONS[currentStage] || []

  // Check if there are any navigation options
  const hasNavigation = stageActions.length > 0 || (isStaff && currentStage !== "completed")

  if (!hasNavigation) {
    return null
  }

  const handleNavigationClick = (nav: {
    label: string
    targetStage: SessionStage
    clearData?: "submission" | "all" | "none"
  }) => {
    setSelectedNavigation(nav)
    setClearDataMode(nav.clearData || "submission")
    setReason("")
    setShowDialog(true)
    setIsOpen(false)
  }

  const handleNavigate = async () => {
    if (!selectedNavigation) return

    setIsLoading(true)
    try {
      const res = await fetch(`/api/proxy/sessions/${sessionId}/actions/navigate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_stage: selectedNavigation.targetStage,
          clear_data: clearDataMode,
          ...(reason && { reason }),
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to navigate")
      }

      toast.success(`Session navigated to ${selectedNavigation.label}`, { duration: 3000 })
      setShowDialog(false)
      setSelectedNavigation(null)
      onNavigationComplete?.()
    } catch (err) {
      console.error("Navigation error:", err)
      const message = err instanceof Error ? err.message : "Failed to navigate"
      toast.error("Navigation failed", {
        description: message,
        duration: 4000,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const clearDataDescription = CLEAR_DATA_MODES[clearDataMode].description

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            Navigate <ChevronDown className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Navigation Options</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Regular stage navigation */}
          {stageActions.length > 0 && (
            <DropdownMenuGroup>
              {stageActions.map((nav) => (
                <DropdownMenuItem
                  key={nav.label}
                  onClick={() => handleNavigationClick(nav)}
                >
                  <IconComponent name={nav.icon as any} className="w-4 h-4 mr-2" />
                  {nav.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          )}

          {/* Staff-only actions */}
          {isStaff && currentStage !== "completed" && (
            <>
              {stageActions.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Staff Only
              </DropdownMenuLabel>
              {STAFF_NAVIGATION_ACTIONS.map((action) => (
                <DropdownMenuItem
                  key={action.label}
                  onClick={() =>
                    handleNavigationClick({
                      label: action.label,
                      targetStage: action.targetStage,
                      clearData: action.clearData,
                    })
                  }
                  className={action.variant === "destructive" ? "text-red-600" : ""}
                >
                  <IconComponent name={action.icon as any} className="w-4 h-4 mr-2" />
                  {action.label}
                </DropdownMenuItem>
              ))}
            </>
          )}

          {/* No options message */}
          {stageActions.length === 0 && (!isStaff || currentStage === "completed") && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              No navigation options available
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Navigation Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Navigate Session</DialogTitle>
            <DialogDescription>
              Move session from <strong>{currentStage}</strong> to{" "}
              <strong>{selectedNavigation?.label}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Clear Data Mode Selection */}
            <div className="space-y-2">
              <Label htmlFor="clear-data">Clear Data Mode</Label>
              <Select value={clearDataMode} onValueChange={(value: any) => setClearDataMode(value)}>
                <SelectTrigger id="clear-data">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="submission">
                    {CLEAR_DATA_MODES.submission.label}
                  </SelectItem>
                  <SelectItem value="all">{CLEAR_DATA_MODES.all.label}</SelectItem>
                  <SelectItem value="none">{CLEAR_DATA_MODES.none.label}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{clearDataDescription}</p>
            </div>

            {/* Optional Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Textarea
                id="reason"
                placeholder="e.g., User requested to re-enter credentials..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="text-sm"
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                This will be recorded in the audit trail
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleNavigate} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Navigating...
                </>
              ) : (
                `Navigate to ${selectedNavigation?.label}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
