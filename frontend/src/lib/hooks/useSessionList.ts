import { useMemo } from 'react'
import { useSessionStore, type SessionData } from "@/lib/stores/sessionStore"

/**
 * Hook to get filtered list of sessions
 *
 * Automatically subscribes to store updates.
 * Returns filtered sessions with real-time updates from WebSocket.
 *
 * Usage:
 * ```
 * // Get all sessions
 * const sessions = useSessionList()
 *
 * // Get sessions by status
 * const activeSessions = useSessionList({ status: 'active' })
 *
 * // Get sessions by agent
 * const mySessions = useSessionList({ agent: 'john_agent' })
 * ```
 */

interface SessionListFilter {
  status?: string
  agent?: string
}

export function useSessionList(
  filter?: SessionListFilter
): SessionData[] {
  // Select the sessions Map directly (atomic, stable reference)
  const sessionsMap = useSessionStore((state) => state.sessions)

  // Filter using useMemo to maintain stable reference
  // This prevents infinite loops by following Zustand v5 requirement:
  // "Selectors must return stable references"
  return useMemo(() => {
    let sessions = Array.from(sessionsMap.values())

    if (filter?.status) {
      sessions = sessions.filter((s) => s.status === filter.status)
    }

    if (filter?.agent) {
      sessions = sessions.filter(
        (s) => s.agent === filter.agent || s.agent_username === filter.agent
      )
    }

    return sessions
  }, [sessionsMap, filter?.status, filter?.agent])
}
