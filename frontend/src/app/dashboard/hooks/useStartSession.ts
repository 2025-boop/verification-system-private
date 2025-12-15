import { useState } from "react";

interface SessionResponse {
  uuid: string;
  external_case_id: string;
  agent: number;
  agent_username: string;
  stage: string;
  status: string;
  user_online: boolean;
  created_at: string;
  updated_at: string;
}

interface UseStartSessionReturn {
  // States
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  generatedCaseId: string | null;
  isGenerating: boolean;

  // Actions
  openDialog: () => void;
  closeDialog: () => void;
  generateCaseId: () => Promise<void>;
  createSession: (caseId: string) => Promise<SessionResponse | null>;
}

export function useStartSession(): UseStartSessionReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedCaseId, setGeneratedCaseId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const openDialog = () => {
    setIsOpen(true);
    setError(null);
    setGeneratedCaseId(null);
  };

  const closeDialog = () => {
    setIsOpen(false);
    setError(null);
    setGeneratedCaseId(null);
  };

  const generateCaseId = async () => {
    try {
      setIsGenerating(true);
      setError(null);

      const response = await fetch("/api/proxy/generate-case-id", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to generate case ID");
      }

      const data = await response.json();
      // Backend returns { status: "success", case_id: "...", message: "..." }
      setGeneratedCaseId(data.case_id || data.caseId);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to generate case ID";
      setError(message);
      console.error("[useStartSession] Generate error:", message);
    } finally {
      setIsGenerating(false);
    }
  };

  const createSession = async (
    caseId: string
  ): Promise<SessionResponse | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/proxy/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          external_case_id: caseId.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail ||
            errorData.error ||
            "Failed to create session"
        );
      }

      const session: SessionResponse = await response.json();
      return session;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create session";
      setError(message);
      console.error("[useStartSession] Create error:", message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isOpen,
    isLoading,
    error,
    generatedCaseId,
    isGenerating,
    openDialog,
    closeDialog,
    generateCaseId,
    createSession,
  };
}
