"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader } from "lucide-react"
import { toast } from "sonner"

interface NotesTabProps {
  sessionId: string
  initialNotes?: string
  onNotesSaved?: (notes: string) => void
}

export function NotesTab({ sessionId, initialNotes = "", onNotesSaved }: NotesTabProps) {
  const [notes, setNotes] = useState(initialNotes)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const handleNotesChange = (value: string) => {
    setNotes(value)
    setHasChanges(value !== initialNotes)
  }

  const handleSaveNotes = async () => {
    if (!hasChanges) return

    setIsSaving(true)
    try {
      const res = await fetch(`/api/proxy/sessions/${sessionId}/actions/save-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to save notes")
      }

      toast.success("Notes saved successfully", { duration: 3000 })
      setHasChanges(false)
      onNotesSaved?.(notes)
    } catch (err) {
      console.error("Save notes error:", err)
      const message = err instanceof Error ? err.message : "Failed to save notes"
      toast.error("Failed to save notes", {
        description: message,
        duration: 4000,
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Agent Notes</CardTitle>
          <CardDescription>Internal notes about this session (not visible to user)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription className="text-xs">
              These notes are private and only visible to agents. They&apos;re useful for documenting decisions,
              flagging issues, or leaving context for other agents.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <Textarea
              placeholder="Add internal notes about this session... (e.g., user seems confused, document quality was poor, suspicious patterns detected)"
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              className="min-h-32 resize-none"
              disabled={isSaving}
            />

            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">{notes.length} characters</p>
              <Button
                onClick={handleSaveNotes}
                disabled={!hasChanges || isSaving}
                className="gap-2"
              >
                {isSaving && <Loader className="w-4 h-4 animate-spin" />}
                {isSaving ? "Saving..." : "Save Notes"}
              </Button>
            </div>
          </div>

          {!hasChanges && initialNotes && (
            <div className="p-3 bg-green-500/5 border border-green-500/20 rounded-lg">
              <p className="text-xs text-green-800">Notes saved ✓</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
