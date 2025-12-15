"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Users,
  Keyboard,
  AlertCircle,
  Loader,
} from "lucide-react";

// Local components
import { StatCard } from "./components/StatCard";
import { SessionItem } from "./components/SessionItem";
import { StartSessionDialog } from "./components/StartSessionDialog";

// Hooks and types
import { useSessionList } from "@/lib/hooks/useSessionList";
import { useSessionStore } from "@/lib/stores/sessionStore";
import type { SessionData } from "@/lib/stores/sessionStore";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  // Get sessions from Zustand store (auto-updates via WebSocket)
  const sessions = useSessionList();

  // Constants
  const SESSIONS_PER_PAGE = 5;

  // Fetch initial sessions data
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/proxy/sessions");

        if (!res.ok) {
          throw new Error(
            `Failed to fetch sessions: ${res.status} ${res.statusText}`
          );
        }

        const data = await res.json();

        // Initialize store from backend data
        // Backend returns either array or paginated { count, results } format
        const sessionList = Array.isArray(data) ? data : data.results || [];
        useSessionStore.getState().setSessionList(sessionList);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load sessions";
        console.error("[Dashboard] Fetch error:", message);
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, []);

  // Compute stats from sessions
  const activeSessionsCount = sessions.filter(
    (s) => s.user_online
  ).length;

  const usersOnlineCount = sessions.filter(
    (s) => s.user_online
  ).length;

  // Note: activity tracking not currently available in session data
  const usersTypingCount = 0;

  // Helper to format time since last update
  const formatLastUpdate = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 30) return "just now";
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  // Helper to determine session status
  const getSessionStatus = (
    session: SessionData
  ): "online" | "typing" | "offline" => {
    if (session.user_online) return "online";
    return "offline";
  };

  if (error) {
    return (
      <div className="flex flex-col gap-10 p-6">
        <div className="flex items-center gap-3 p-4 bg-destructive/20 border border-destructive/30 rounded-lg">
          <AlertCircle className="w-5 h-5 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Error loading sessions</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10 p-6">

      {/* ---------- STATS ROW ---------- */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Active Sessions"
          value={loading ? "-" : activeSessionsCount}
          icon={<Activity className="w-5 h-5 text-primary" />}
          description={loading ? "Loading..." : "Currently active"}
        />

        <StatCard
          title="Users Online"
          value={loading ? "-" : usersOnlineCount}
          icon={<Users className="w-5 h-5 text-primary" />}
          description={loading ? "Loading..." : "Across all channels"}
        />

        <StatCard
          title="Users Typing"
          value={loading ? "-" : usersTypingCount}
          icon={<Keyboard className="w-5 h-5 text-primary" />}
          description={loading ? "Loading..." : "Typing right now"}
        />
      </div>

      {/* ---------- LIVE SESSIONS FULL WIDTH ---------- */}
      <Card className="glass-panel">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Live Sessions Activity</CardTitle>
          <StartSessionDialog />
        </CardHeader>

        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">
                No sessions yet. Start one to get going!
              </p>
            </div>
          ) : (
            <>
              {sessions
                .sort((a, b) => b.lastUpdated - a.lastUpdated)
                .slice(0, showAll ? undefined : SESSIONS_PER_PAGE)
                .map((session) => (
                  <SessionItem
                    key={session.uuid}
                    id={session.uuid}
                    status={getSessionStatus(session)}
                    stage={session.stage || "Unknown"}
                    lastUpdate={formatLastUpdate(session.lastUpdated)}
                    caseId={session.external_case_id}
                  />
                ))}

              {sessions.length > SESSIONS_PER_PAGE && !showAll && (
                <div className="flex items-center justify-center pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowAll(true)}
                  >
                    Show All {sessions.length} Sessions
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
