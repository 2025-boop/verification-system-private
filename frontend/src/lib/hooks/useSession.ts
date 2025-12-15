import { useSessionStore, type SessionData } from "@/lib/stores/sessionStore"

/**
 * Hook to get a single session by ID
 *
 * Automatically subscribes to store updates.
 * Returns the session data with real-time updates from WebSocket.
 *
 * Usage:
 * ```
 * const session = useSession(sessionId)
 * if (!session) return <div>Session not found</div>
 * ```
 */
export function useSession(uuid: string | null): SessionData | undefined {
  // IMPORTANT: Must call the hook BEFORE any early returns
  // This follows React's Rules of Hooks - hooks must be called unconditionally
  const session = useSessionStore((state) => (uuid ? state.getSession(uuid) : undefined))

  return session
}
