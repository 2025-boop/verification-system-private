"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MonitorSmartphone, Trash2, Loader } from "lucide-react";

export function SessionItem({
  id,
  status,
  stage,
  lastUpdate,
  caseId,
}: {
  id: string;
  status: "online" | "typing" | "offline";
  stage: string;
  lastUpdate: string;
  caseId?: string;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/proxy/sessions/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete session");
      }

      // Backend will broadcast session_deleted event
      // which triggers removal from UI via dashboard broadcast handler
    } catch (err) {
      console.error("[SessionItem] Delete error:", err);
      setIsDeleting(false);
    }
  };

  const statusMap = {
    online: "bg-green-500/20 text-green-400 border-green-500/30",
    typing: "bg-primary/20 text-primary border-primary/20",
    offline: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  return (
    <div className="group flex items-center justify-between p-3 rounded-lg hover:bg-muted/40 border border-transparent hover:border-border/50 transition">
      <Link
        href={`/dashboard/sessions/${id}`}
        className="flex flex-col flex-1 gap-1"
      >
        <div className="flex items-center gap-2">
          <MonitorSmartphone className="w-5 h-5 text-primary" />
          <p className="font-medium">
            {caseId ? `Case ${caseId}` : `Session ${id.substring(0, 8)}`}
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          Stage: <span className="font-medium">{stage}</span>
        </p>
        <p className="text-xs text-muted-foreground">Last activity: {lastUpdate}</p>
      </Link>

      <Badge
        variant="outline"
        className={`capitalize ${statusMap[status]} ml-3`}
      >
        {status}
      </Badge>

      <Button
        variant="ghost"
        size="icon"
        className="ml-3 opacity-70 hover:opacity-100"
        onClick={handleDelete}
        disabled={isDeleting}
      >
        {isDeleting ? (
          <Loader className="w-4 h-4 animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
      </Button>
    </div>
  );
}
