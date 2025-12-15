// src/lib/types/ws.ts
export type SessionStatus =
  | "active"
  | "monitoring"
  | "idle"
  | "closed"
  | "typing"
  | "online"
  | "offline";

export interface SessionPayload {
  uuid: string;
  case_id?: string;
  stage?: string;
  user_online?: boolean;
  agent?: string;
  ping?: string;
  [key: string]: any;
}

/**
 * Backend message envelope exactly as your Django Channels sends it.
 */
export type BackendMessage =
  | { type: "connection_established"; message?: string; user?: string }
  | { type: "user_status"; uuid: string; case_id?: string; status: string; data?: any }
  | { type: "session_update"; uuid: string; case_id?: string; stage?: string; user_online?: boolean; message?: string; [k: string]: any }
  | { type: "control_message"; message: string }
  | { type: "broadcast"; event: string; data?: any }
  | { type: "device_metadata"; uuid: string; metadata: Record<string, any> }
  | { type: "user_activity"; uuid: string; activity: string; data?: any }
  | { type: "session_started"; uuid: string; data?: any }
  | { type: "page_view"; uuid: string; data?: any }
  // fallback raw
  | ({ type: string } & Record<string, any>);
