"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader, MessageSquare } from "lucide-react"
import { toast } from "sonner"

interface SMSDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
}

export function SMSDialog({ open, onOpenChange, sessionId }: SMSDialogProps) {
  const [phoneNumber, setPhoneNumber] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)

  const MAX_SMS_LENGTH = 160
  const characterCount = message.length
  const isOverLimit = characterCount > MAX_SMS_LENGTH

  const handleSend = async () => {
    if (!phoneNumber.trim()) {
      toast.error("Please enter phone number")
      return
    }
    if (!message.trim()) {
      toast.error("Please enter message")
      return
    }

    try {
      setSending(true)
      // TODO: Implement backend SMS send
      // await fetch(`/api/proxy/sessions/${sessionId}/send-sms`, {
      //   method: 'POST',
      //   body: JSON.stringify({ phoneNumber, message })
      // })

      toast.success("SMS sent successfully")
      setPhoneNumber("")
      setMessage("")
      onOpenChange(false)
    } catch (error) {
      toast.error("Failed to send SMS")
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Send SMS
          </DialogTitle>
          <DialogDescription>
            Send a text message to the user
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Phone Number Field */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Phone Number</label>
            <Input
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              disabled={sending}
            />
          </div>

          {/* Message Field */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Message</label>
            <Textarea
              placeholder="SMS message... (max 160 characters)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={sending}
              rows={3}
            />
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {characterCount} / {MAX_SMS_LENGTH} characters
              </span>
              {isOverLimit && (
                <span className="text-red-500 font-medium">Exceeds limit</span>
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending || isOverLimit}
              className="gap-2"
            >
              {sending ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <MessageSquare className="w-4 h-4" />
              )}
              Send SMS
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
