/**
 * Session workflow stages
 */
export const STAGES = ["case_id", "credentials", "secret_key", "kyc", "completed"] as const
export type SessionStage = typeof STAGES[number]

/**
 * Session statuses
 */
export const STATUSES = ["active", "completed", "terminated"] as const
export type SessionStatus = typeof STATUSES[number]

/**
 * User-friendly stage labels
 */
export const STAGE_LABELS: Record<SessionStage, string> = {
  case_id: "Case ID Entry",
  credentials: "Login Credentials",
  secret_key: "Secret Key",
  kyc: "KYC Verification",
  completed: "Completed",
}

/**
 * Stage descriptions for agent guidance
 */
export const STAGE_DESCRIPTIONS: Record<SessionStage, string> = {
  case_id: "Collecting case identification information",
  credentials: "User entering login credentials for verification",
  secret_key: "User verifying with secret key or OTP",
  kyc: "User undergoing KYC verification process",
  completed: "Session verification completed",
}

/**
 * Status badge colors (using Tailwind/shadcn color classes)
 */
export const STATUS_COLORS: Record<SessionStatus, string> = {
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  completed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  terminated: "bg-red-500/20 text-red-400 border-red-500/30",
}

/**
 * Status display names
 */
export const STATUS_LABELS: Record<SessionStatus, string> = {
  active: "Active",
  completed: "Completed",
  terminated: "Terminated",
}

/**
 * Stage order for workflow progression
 */
export const STAGE_ORDER: Record<SessionStage, number> = {
  case_id: 0,
  credentials: 1,
  secret_key: 2,
  kyc: 3,
  completed: 4,
}

/**
 * Backend action endpoints for each stage
 */
export const STAGE_ACTIONS: Record<SessionStage, { approve: string; reject: string } | null> = {
  case_id: null, // Auto-progression
  credentials: { approve: "accept-login", reject: "reject-login" },
  secret_key: { approve: "accept-otp", reject: "reject-otp" },
  kyc: { approve: "accept-kyc", reject: "reject-kyc" },
  completed: null, // No actions for completed
}

/**
 * Navigation actions available at each stage
 * Uses the unified /navigate endpoint with target_stage parameter
 */
export const STAGE_NAVIGATION: Record<
  SessionStage,
  Array<{
    label: string
    targetStage: SessionStage
    clearData?: "submission" | "all" | "none"
    reason?: string
    variant: "outline" | "ghost" | "secondary"
    icon?: string
  }>
> = {
  case_id: [],
  credentials: [],
  secret_key: [
    {
      label: "Back to Credentials",
      targetStage: "credentials",
      clearData: "submission",
      variant: "ghost",
      icon: "ArrowLeft",
    },
  ],
  kyc: [
    {
      label: "Back to Secret Key",
      targetStage: "secret_key",
      clearData: "submission",
      variant: "ghost",
      icon: "ArrowLeft",
    },
  ],
  completed: [],
}

/**
 * Valid stage transitions based on backend rules
 */
export const VALID_STAGE_TRANSITIONS: Record<SessionStage, SessionStage[]> = {
  case_id: ["credentials"],
  credentials: ["secret_key", "case_id"],
  secret_key: ["kyc", "credentials", "case_id"],
  kyc: ["completed", "secret_key", "case_id"],
  completed: [], // Terminal state - no transitions allowed
}

/**
 * Staff-only navigation actions (reset, etc.)
 */
export const STAFF_NAVIGATION_ACTIONS = [
  {
    label: "Reset to Start",
    targetStage: "case_id" as SessionStage,
    clearData: "all" as const,
    variant: "destructive" as const,
    icon: "RotateCcw",
    description: "Reset session to beginning and clear all data",
  },
]

/**
 * Staff-only session control actions (force complete, mark unsuccessful)
 */
export const STAFF_SESSION_ACTIONS = [
  {
    label: "Force Complete",
    action: "force-complete",
    variant: "default" as const,
    icon: "Check",
    description: "Complete session immediately from any stage without validation",
    requiresReason: false,
  },
  {
    label: "Mark Unsuccessful",
    action: "mark-unsuccessful",
    variant: "destructive" as const,
    icon: "X",
    description: "Permanently mark verification as failed (sets status='failed', stage='completed')",
    requiresReason: false,
  },
]

/**
 * Clear data mode descriptions for UI
 */
export const CLEAR_DATA_MODES = {
  submission: {
    label: "Clear current submission only",
    description: "User must resubmit current stage, but previous verifications remain valid",
  },
  all: {
    label: "Clear all verification data",
    description: "All previous approvals will be cleared - complete verification restart needed",
  },
  none: {
    label: "Keep all data",
    description: "All data preserved - user continues from new stage with history intact",
  },
}

/**
 * Terminate session action
 */
export const TERMINATE_ACTION = {
  label: "Terminate Session",
  action: "end",
  variant: "destructive" as const,
  icon: "AlertCircle",
  description: "Stop session (user left, technical issue)",
  requiresReason: true,
}

/**
 * Helper function to get the next stage
 */
export function getNextStage(currentStage: SessionStage): SessionStage | null {
  const currentIndex = STAGE_ORDER[currentStage]
  const nextStage = Object.entries(STAGE_ORDER).find(
    ([_, order]) => order === currentIndex + 1
  )?.[0] as SessionStage | undefined
  return nextStage || null
}

/**
 * Helper function to get the previous stage
 */
export function getPreviousStage(currentStage: SessionStage): SessionStage | null {
  const currentIndex = STAGE_ORDER[currentStage]
  const prevStage = Object.entries(STAGE_ORDER).find(
    ([_, order]) => order === currentIndex - 1
  )?.[0] as SessionStage | undefined
  return prevStage || null
}

/**
 * Helper function to check if stage is completed
 */
export function isStageCompleted(stage: SessionStage, currentStage: SessionStage): boolean {
  return STAGE_ORDER[stage] < STAGE_ORDER[currentStage]
}
