"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader, RefreshCw } from "lucide-react";
import { useStartSession } from "../hooks/useStartSession";

interface StartSessionDialogProps {
  onSessionCreated?: (sessionId: string) => void;
}

export function StartSessionDialog({
  onSessionCreated,
}: StartSessionDialogProps) {
  const {
    isOpen,
    isLoading,
    error,
    generatedCaseId,
    isGenerating,
    openDialog,
    closeDialog,
    generateCaseId,
    createSession,
  } = useStartSession();

  const [manualCaseId, setManualCaseId] = useState("");
  const [useManual, setUseManual] = useState(false);

  const handleGenerateCaseId = async () => {
    await generateCaseId();
  };

  const handleCreateSession = async () => {
    const caseId = useManual ? manualCaseId : generatedCaseId || "";

    if (!caseId.trim()) {
      return;
    }

    const session = await createSession(caseId);

    if (session) {
      // Reset form
      setManualCaseId("");
      setUseManual(false);

      // Close dialog
      closeDialog();

      // Notify parent
      if (onSessionCreated) {
        onSessionCreated(session.uuid);
      }
    }
  };

  const selectedCaseId = useManual ? manualCaseId : generatedCaseId;
  const isReadyToCreate = selectedCaseId && selectedCaseId.trim().length > 0;

  return (
    <>
      {/* Trigger Button */}
      <Button
        size="sm"
        className="flex items-center gap-2"
        onClick={openDialog}
      >
        <span>Start Session</span>
      </Button>

      {/* Dialog */}
      <Dialog open={isOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Session</DialogTitle>
            <DialogDescription>
              Enter or generate a case ID to start a new verification session
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="flex gap-3 p-3 bg-destructive/20 border border-destructive/30 rounded-lg">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">Error</p>
                  <p className="text-xs text-destructive/80">{error}</p>
                </div>
              </div>
            )}

            {/* Tab-like Switch */}
            <div className="flex gap-2 bg-muted p-1 rounded-lg">
              <Button
                variant={useManual ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  setUseManual(true);
                  setManualCaseId("");
                }}
                className="flex-1"
              >
                Manual Entry
              </Button>
              <Button
                variant={!useManual ? "default" : "ghost"}
                size="sm"
                onClick={() => setUseManual(false)}
                className="flex-1"
              >
                Generate
              </Button>
            </div>

            {/* Manual Entry Tab */}
            {useManual ? (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="case-id" className="text-sm">
                    Case ID
                  </Label>
                  <Input
                    id="case-id"
                    placeholder="Enter case ID (e.g., ABC123456)"
                    value={manualCaseId}
                    onChange={(e) => setManualCaseId(e.target.value)}
                    disabled={isLoading}
                    className="mt-1.5"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Enter a unique identifier for this case
                  </p>
                </div>
              </div>
            ) : (
              /* Generate Tab */
              <div className="space-y-3">
                <div>
                  <Label className="text-sm">Generated Case ID</Label>
                  {generatedCaseId ? (
                    <div className="mt-1.5 p-3 bg-muted rounded-lg border border-border">
                      <p className="font-mono text-sm font-medium">
                        {generatedCaseId}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-1.5 p-3 bg-muted/50 rounded-lg border border-dashed border-border text-center">
                      <p className="text-xs text-muted-foreground">
                        Click "Generate" to create a case ID
                      </p>
                    </div>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateCaseId}
                  disabled={isGenerating || isLoading}
                  className="w-full"
                >
                  {isGenerating ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Generate New ID
                    </>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground">
                  Press the button multiple times to generate different IDs until
                  you find one you like
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={closeDialog}
                disabled={isLoading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateSession}
                disabled={!isReadyToCreate || isLoading || isGenerating}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  "Create Session"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
