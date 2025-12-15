// src/lib/ws/provider.tsx
"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { getSocketClient } from "./socket";
import type { SocketClient } from "./socket";
import type { BackendMessage } from "@/lib/types/ws";
import { initializeStoreWebSocketSubscriptions } from "@/lib/stores/sessionStore";

declare global {
  interface Window {
    __ENV?: {
      NEXT_PUBLIC_WS_URL?: string;
      [key: string]: string | undefined;
    };
  }
}

const WS_URL =
  (typeof window !== "undefined" ? window.__ENV?.NEXT_PUBLIC_WS_URL : undefined) ||
  process.env.NEXT_PUBLIC_WS_URL ||
  "";

/**
 * WebSocket Provider for real-time communication with Django Channels backend.
 *
 * Architecture:
 * - NEXT_PUBLIC_WS_URL stores the BASE URL (e.g., ws://localhost:8000)
 * - This provider constructs the FULL endpoint (e.g., ws://localhost:8000/ws/control-room/)
 * - The SocketClient receives the complete URL and initiates the connection
 *
 * Available endpoints:
 * - /ws/control-room/ → Agent control room dashboard (this provider)
 * - /ws/session/<uuid>/ → Single session WebSocket (can be created per-session if needed)
 */

type WSContext = {
  client: SocketClient | null;
  connected: boolean;
  send: (m: Record<string, any>) => string | undefined;
  subscribe: (type: string, cb: (payload: any, raw?: BackendMessage) => void) => () => void;
  subscribeAll: (cb: (payload: any, raw?: BackendMessage) => void) => () => void;
};

const ctx = createContext<WSContext>({
  client: null,
  connected: false,
  send: () => undefined,
  subscribe: () => () => { },
  subscribeAll: () => () => { },
});

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const clientRef = useRef<SocketClient | null>(null);
  const [connected, setConnected] = useState(false);
  const tokenRefreshAttemptsRef = useRef(0);
  const maxTokenRefreshAttempts = 3;

  /**
   * Fetch a fresh access token from the backend
   */
  const fetchToken = async (): Promise<string | null> => {
    try {
      const response = await fetch("/api/auth/ws-token");

      if (!response.ok) {
        console.error(
          "[WebSocketProvider] Failed to fetch WS token:",
          response.status,
          response.statusText
        );
        return null;
      }

      const data = await response.json();

      if (!data.ok || !data.token) {
        console.error("[WebSocketProvider] Invalid token response:", data);
        return null;
      }

      return data.token;
    } catch (error) {
      console.error("[WebSocketProvider] Error fetching WS token:", error);
      return null;
    }
  };

  /**
   * Initialize WebSocket connection with token
   */
  const initializeWebSocket = async () => {
    if (!WS_URL) {
      console.warn("[WebSocketProvider] NEXT_PUBLIC_WS_URL not set");
      return null;
    }

    // Fetch access token for WebSocket authentication
    const token = await fetchToken();

    if (!token) {
      console.error(
        "[WebSocketProvider] Could not obtain access token - user may not be authenticated"
      );
      return null;
    }

    // Construct full WebSocket URL for control room
    const fullWsUrl = `${WS_URL}/ws/control-room/`;
    console.log("[WebSocketProvider] Connecting to:", fullWsUrl);

    const client = getSocketClient(fullWsUrl, token);
    clientRef.current = client;

    const onOpen = () => {
      setConnected(true);
      // Reset token refresh attempts on successful connection
      tokenRefreshAttemptsRef.current = 0;
      console.log("[WebSocketProvider] Connected successfully");
    };

    const onClose = () => {
      setConnected(false);
      console.log("[WebSocketProvider] Disconnected");
    };

    /**
     * Handle authentication errors by attempting to refresh token and reconnect
     */
    const onAuthError = async (p: any) => {
      console.error("[WebSocketProvider] WebSocket auth error:", p);

      // Attempt to refresh token and reconnect
      if (tokenRefreshAttemptsRef.current < maxTokenRefreshAttempts) {
        tokenRefreshAttemptsRef.current++;
        console.log(
          `[WebSocketProvider] Attempting token refresh (attempt ${tokenRefreshAttemptsRef.current}/${maxTokenRefreshAttempts})`
        );

        try {
          // Refresh the access token
          const refreshResponse = await fetch("/api/auth/refresh", {
            method: "POST",
          });

          if (!refreshResponse.ok) {
            console.error(
              "[WebSocketProvider] Token refresh failed:",
              refreshResponse.status
            );
            // Redirect to login
            window.location.href = "/login";
            return;
          }

          // Fetch new WebSocket token
          const newToken = await fetchToken();

          if (!newToken) {
            console.error("[WebSocketProvider] Could not obtain new token");
            window.location.href = "/login";
            return;
          }

          // Update token and reconnect
          console.log("[WebSocketProvider] Token refreshed, reconnecting...");
          client.updateToken(newToken);
        } catch (error) {
          console.error(
            "[WebSocketProvider] Error during token refresh:",
            error
          );
          window.location.href = "/login";
        }
      } else {
        // Max refresh attempts exceeded, redirect to login
        console.error(
          "[WebSocketProvider] Max token refresh attempts exceeded, redirecting to login"
        );
        window.location.href = "/login";
      }
    };

    client.subscribe("open", onOpen);
    client.subscribe("close", onClose);
    client.subscribe("auth_error", onAuthError);

    client.connect();

    // Initialize Zustand store WebSocket subscriptions
    // This sets up automatic state updates from WebSocket messages
    const cleanupStoreSubscriptions = initializeStoreWebSocketSubscriptions(
      (type, cb) => client.subscribe(type, cb)
    );

    return cleanupStoreSubscriptions;
  };

  useEffect(() => {
    let cleanupStoreSubscriptions: (() => void) | null = null;

    initializeWebSocket().then((cleanup) => {
      cleanupStoreSubscriptions = cleanup || null;
    });

    return () => {
      if (cleanupStoreSubscriptions) {
        cleanupStoreSubscriptions();
      }
      // Note: our SocketClient.subscribe returns an unsubscribe — callers should use that pattern when subscribing
    };
  }, []);

  const send = (m: Record<string, any>) => clientRef.current?.send(m);

  const subscribe = (type: string, cb: (payload: any, raw?: BackendMessage) => void) => {
    if (!clientRef.current) return () => { };
    return clientRef.current.subscribe(type, cb);
  };

  const subscribeAll = (cb: (payload: any, raw?: BackendMessage) => void) => {
    if (!clientRef.current) return () => { };
    return clientRef.current.subscribeAll(cb);
  };

  return (
    <ctx.Provider value={{ client: clientRef.current, connected, send, subscribe, subscribeAll }}>
      {children}
    </ctx.Provider>
  );
}

export function useWebSocket() {
  return useContext(ctx);
}
