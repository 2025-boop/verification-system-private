// src/lib/ws/events.ts
export const WS_BACKEND_EVENTS = {
  CONNECTION_ESTABLISHED: "connection_established",
  USER_STATUS: "user_status",
  SESSION_UPDATE: "session_update",
  CONTROL_MESSAGE: "control_message",
  BROADCAST: "broadcast",
  DEVICE_METADATA: "device_metadata",
  USER_ACTIVITY: "user_activity",
  SESSION_STARTED: "session_started",
  PAGE_VIEW: "page_view",
} as const;

export type BackendEvent = typeof WS_BACKEND_EVENTS[keyof typeof WS_BACKEND_EVENTS];
