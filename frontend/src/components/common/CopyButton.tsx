"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Copy, Check } from "lucide-react"
import { toast } from "sonner"

interface CopyButtonProps {
  value: string
  label?: string
  className?: string
}

export function CopyButton({
  value,
  label,
  className = "",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)

      // Show toast notification
      toast.success(`${label || "Value"} copied to clipboard`, {
        duration: 2000,
      })

      // Reset icon after 2 seconds
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast.error("Failed to copy")
      console.error("Copy failed:", err)
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={handleCopy}
      className={`h-6 w-6 p-0 hover:bg-muted/50 flex-shrink-0 ${className}`}
      title={`Copy ${label || "value"}`}
    >
      {copied ? (
        <Check className="w-4 h-4 text-green-600" />
      ) : (
        <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground" />
      )}
    </Button>
  )
}
