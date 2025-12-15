// src/lib/ws/socket.ts
import { v4 as uuidv4 } from "uuid";
import type { BackendMessage } from "@/lib/types/ws";
import { WS_BACKEND_EVENTS } from "./events";

/**
 * Minimal EventEmitter replacement (small & browser friendly)
 */
type Listener = (payload: any, raw?: BackendMessage) => void;

class TinyEmitter {
  private handlers: Record<string, Set<Listener>> = {};
  on(ev: string, cb: Listener) {
    this.handlers[ev] = this.handlers[ev] ?? new Set();
    this.handlers[ev].add(cb);
  }
  off(ev: string, cb: Listener) {
    this.handlers[ev]?.delete(cb);
  }
  emit(ev: string, payload?: any, raw?: BackendMessage) {
    this.handlers[ev]?.forEach((cb) => cb(payload, raw));
    // wildcard handlers
    this.handlers["*"]?.forEach((cb) => cb(payload, raw));
  }
}

export class SocketClient {
  private baseUrl: string;
  private url: string;
  private ws: WebSocket | null = null;
  private emitter = new TinyEmitter();
  private sendQueue: any[] = [];
  private connected = false;
  private heartbeatTimer: number | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 50;
  private shouldReconnect = true;
  private heartbeatIntervalMs = 25000;

  constructor(url: string, token?: string) {
    this.baseUrl = url;
    this.url = this.buildUrl(token);
  }

  private buildUrl(token?: string): string {
    if (!token) return this.baseUrl;
    const separator = this.baseUrl.includes('?') ? '&' : '?';
    return `${this.baseUrl}${separator}token=${encodeURIComponent(token)}`;
  }

  /**
   * Update the authentication token and reconnect.
   * Used for token refresh when the current token expires.
   */
  updateToken(token: string) {
    this.url = this.buildUrl(token);
    // Disconnect and reconnect with new token
    this.disconnect();
    this.connect();
  }

  connect() {
    if (this.ws) return;
    this.shouldReconnect = true;
    this._connect();
  }

  private _connect() {
    this.ws = new WebSocket(this.url, /* protocols */ []);
    this.ws.addEventListener("open", () => {
      this.reconnectAttempts = 0;
      this.connected = true;
      this.emitter.emit("open");
      this.flushQueue();
      this.startHeartbeat();
    });

    this.ws.addEventListener("message", (ev) => {
      try {
        const data = JSON.parse(ev.data) as BackendMessage;
        if (data && typeof data.type === "string") {
          // emit specific type and generic 'message'
          this.emitter.emit(data.type, data, data);
          this.emitter.emit("message", data, data);
          // auto-pong if backend pings with "ping" (not in your list, but safe)
          if ((data as any).type === "ping") {
            this.send({ type: "pong" });
          }
        } else {
          this.emitter.emit("raw", ev.data, undefined);
        }
      } catch (err) {
        this.emitter.emit("error", err);
      }
    });

    this.ws.addEventListener("close", (ev) => {
      this.connected = false;
      this.emitter.emit("close", ev);
      this.stopHeartbeat();

      // special handling: Channels returns 4003 for unauthorized (as you noted)
      // custom close codes from server are in ev.code
      if (ev && ev.code === 4003) {
        this.emitter.emit("auth_error", { code: 4003, reason: ev.reason || "unauthorized" });
        // do not attempt to reconnect if server explicitly rejects
        this.shouldReconnect = false;
        return;
      }

      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    });

    this.ws.addEventListener("error", (e) => {
      this.emitter.emit("error", e);
      // let close handle reconnect
    });
  }

  disconnect() {
    this.shouldReconnect = false;
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(obj: Record<string, any>) {
    const payload = { ...obj, requestId: obj.requestId ?? uuidv4() };
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.sendQueue.push(payload);
      return payload.requestId;
    }
    try {
      this.ws.send(JSON.stringify(payload));
      return payload.requestId;
    } catch (err) {
      this.sendQueue.push(payload);
      return payload.requestId;
    }
  }

  private flushQueue() {
    while (this.sendQueue.length && this.ws && this.ws.readyState === WebSocket.OPEN) {
      const m = this.sendQueue.shift();
      this.ws.send(JSON.stringify(m));
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emitter.emit("reconnect_failed");
      return;
    }
    const t = Math.min(30000, 500 * Math.pow(1.6, this.reconnectAttempts));
    this.reconnectAttempts++;
    setTimeout(() => this._connect(), t);
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      // prefer backend ping/pong — but send a lightweight keepalive if needed
      this.send({ type: "ping" });
    }, this.heartbeatIntervalMs);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // subscribe to a specific backend message type
  subscribe(type: string, cb: Listener) {
    this.emitter.on(type, cb);
    return () => this.emitter.off(type, cb);
  }

  // subscribe to any message (wildcard)
  subscribeAll(cb: Listener) {
    this.emitter.on("*", cb);
    return () => this.emitter.off("*", cb);
  }
}

/* singleton factory (per-page lifetime) */
let _client: SocketClient | null = null;
export function getSocketClient(url: string, token?: string) {
  if (!_client) _client = new SocketClient(url, token);
  return _client;
}
