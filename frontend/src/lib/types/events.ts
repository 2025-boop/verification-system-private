/**
 * Event types for session timeline/logs
 */

export type EventCategory = "user" | "system" | "agent" | "error"
export type EventType =
  | "session_created"
  | "stage_changed"
  | "user_submitted"
  | "validation_success"
  | "validation_failed"
  | "agent_action"
  | "agent_approved"
  | "agent_rejected"
  | "user_online"
  | "user_offline"
  | "timeout"
  | "error"
  | "note_added"

export interface SessionEvent {
  id: string
  timestamp: string
  type: EventType
  category: EventCategory
  title: string
  description?: string
  metadata?: Record<string, any>
  severity?: "info" | "warning" | "error" | "success"
}

/**
 * Transform Django SessionLog to frontend SessionEvent
 */
export interface SessionLogResponse {
  id: number
  message: string
  log_type: string
  extra_data?: Record<string, any>
  created_at: string
}

export function transformSessionLog(log: SessionLogResponse): SessionEvent {
  const { id, message, log_type, extra_data, created_at } = log

  // Map log_type to category and event type
  let category: EventCategory = "system"
  let type: EventType = "agent_action"
  let severity: "info" | "warning" | "error" | "success" = "info"

  switch (log_type) {
    case "agent_action":
      category = "agent"
      type = "agent_action"
      severity = "info"
      break
    case "user_input":
      category = "user"
      type = "user_submitted"
      severity = "info"
      break
    case "session_start":
      category = "system"
      type = "session_created"
      severity = "info"
      break
    case "user_activity":
      category = "user"
      type = "user_online"
      severity = "info"
      break
    case "page_view":
      category = "user"
      type = "user_submitted"
      severity = "info"
      break
    case "device_metadata":
      category = "system"
      type = "agent_action"
      severity = "info"
      break
    case "info":
      category = "system"
      type = "agent_action"
      severity = "info"
      break
    default:
      category = "system"
      type = "agent_action"
      severity = "info"
  }

  // Parse message to extract title and description
  const [title, ...descriptionParts] = message.split(" - ")
  const description = descriptionParts.length > 0 ? descriptionParts.join(" - ") : undefined

  return {
    id: String(id),
    timestamp: created_at,
    type,
    category,
    title: title || message,
    description: description || message,
    metadata: extra_data,
    severity,
  }
}

export function transformSessionLogs(logs: SessionLogResponse[]): SessionEvent[] {
  return logs.map(transformSessionLog).sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
}

/**
 * Mock event generator for development
 */
export function generateMockEvents(sessionId: string, count: number = 15): SessionEvent[] {
  const now = new Date()
  const events: SessionEvent[] = []

  const eventTemplates = [
    {
      type: "session_created" as EventType,
      category: "system" as EventCategory,
      title: "Session Created",
      description: "New verification session started",
      severity: "info" as const,
    },
    {
      type: "user_submitted" as EventType,
      category: "user" as EventCategory,
      title: "User Submitted Data",
      description: "User entered credentials",
      severity: "info" as const,
    },
    {
      type: "validation_success" as EventType,
      category: "system" as EventCategory,
      title: "Validation Passed",
      description: "Data passed validation checks",
      severity: "success" as const,
    },
    {
      type: "agent_approved" as EventType,
      category: "agent" as EventCategory,
      title: "Step Approved",
      description: "Agent approved this step",
      severity: "success" as const,
    },
    {
      type: "stage_changed" as EventType,
      category: "system" as EventCategory,
      title: "Stage Advanced",
      description: "Session moved to next stage",
      severity: "info" as const,
    },
    {
      type: "user_online" as EventType,
      category: "user" as EventCategory,
      title: "User Online",
      description: "User is actively using the application",
      severity: "info" as const,
    },
    {
      type: "note_added" as EventType,
      category: "agent" as EventCategory,
      title: "Note Added",
      description: "Agent added internal notes",
      severity: "info" as const,
    },
  ]

  for (let i = 0; i < count; i++) {
    const template = eventTemplates[i % eventTemplates.length]
    const minutesAgo = i * 5
    const eventTime = new Date(now.getTime() - minutesAgo * 60 * 1000)

    events.push({
      id: `${sessionId}-event-${i}`,
      timestamp: eventTime.toISOString(),
      type: template.type,
      category: template.category,
      title: template.title,
      description: template.description,
      severity: template.severity,
      metadata: {
        agent: i % 3 === 0 ? "agent_john" : undefined,
        stage: i > 5 ? "secret_key" : "credentials",
      },
    })
  }

  // Sort by timestamp descending (newest first)
  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}
