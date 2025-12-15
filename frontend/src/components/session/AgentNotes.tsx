"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader } from "lucide-react"
import { toast } from "sonner"

interface AgentNotesProps {
  sessionId: string
  notes: string
  onNotesSaved?: (notes: string) => void
}

export function AgentNotes({ sessionId, notes: initialNotes, onNotesSaved }: AgentNotesProps) {
  const [notesValue, setNotesValue] = useState(initialNotes)
  const [isSaving, setIsSaving] = useState(false)

  const handleSaveNotes = async () => {
    if (notesValue === initialNotes) {
      return // No changes
    }

    try {
      setIsSaving(true)
      const res = await fetch(`/api/proxy/sessions/${sessionId}/actions/save-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesValue }),
      })

      if (!res.ok) throw new Error("Failed to save notes")

      onNotesSaved?.(notesValue)
      toast.success("Notes saved")
    } catch (error) {
      toast.error("Failed to save notes")
      setNotesValue(initialNotes)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Agent Notes</CardTitle>
        <CardDescription>Document observations and findings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          placeholder="Add your observations and findings here..."
          value={notesValue}
          onChange={(e) => setNotesValue(e.target.value)}
          className="min-h-24 text-sm"
          disabled={isSaving}
        />
        {notesValue !== initialNotes && (
          <Button
            onClick={handleSaveNotes}
            disabled={isSaving}
            size="sm"
            className="w-full"
          >
            {isSaving ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Notes"
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
