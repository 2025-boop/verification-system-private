"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader, Mail } from "lucide-react"
import { toast } from "sonner"
import { useCompanies, useEmailTemplates, useSendEmail } from "@/lib/hooks/useEmail"
import type { SessionData } from "@/lib/stores/sessionStore"

interface EmailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
  session?: SessionData
}

/**
 * Simplified Email Dialog
 * 
 * Agent only needs to:
 * 1. Select Company
 * 2. Select Template
 * 3. Enter customer email
 * 4. Enter customer name (optional)
 * 
 * All template variables (verification_link, case_id, company_name, etc.)
 * are auto-populated by the backend from Company/Session data.
 */
export function EmailDialog({ open, onOpenChange, sessionId, session }: EmailDialogProps) {
  // Form state - simplified to only what agent needs to enter
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | "">("")
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | "">("")
  const [toEmail, setToEmail] = useState("")
  const [customerName, setCustomerName] = useState("")

  // Data fetching
  const { companies, loading: companiesLoading, fetchCompanies } = useCompanies()
  const { templates, loading: templatesLoading, fetchTemplates } = useEmailTemplates()
  const { sendEmail, loading: sendingEmail } = useSendEmail()

  // Initialize form when dialog opens
  useEffect(() => {
    if (open) {
      fetchCompanies()
    }
  }, [open, fetchCompanies])

  // Fetch templates when company is selected
  useEffect(() => {
    if (selectedCompanyId) {
      fetchTemplates(selectedCompanyId as number)
      setSelectedTemplateId("") // Clear template selection when company changes
    }
  }, [selectedCompanyId, fetchTemplates])

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedCompanyId("")
      setSelectedTemplateId("")
      setToEmail("")
      setCustomerName("")
    }
  }, [open])

  // Handle form submission
  const handleSend = async () => {
    // Validation
    if (!selectedCompanyId) {
      toast.error("Please select a company")
      return
    }
    if (!selectedTemplateId) {
      toast.error("Please select a template")
      return
    }
    if (!toEmail.trim()) {
      toast.error("Please enter recipient email")
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(toEmail)) {
      toast.error("Please enter a valid email address")
      return
    }

    try {
      // Simplified payload - backend handles all variable population
      const payload = {
        company_id: selectedCompanyId as number,
        template_id: selectedTemplateId as number,
        to_email: toEmail,
        customer_name: customerName || undefined,
        template_variables: {}, // Empty - backend auto-populates from Company/Session
      }

      const result = await sendEmail(sessionId, payload)

      if (result) {
        toast.success(`Email queued to ${toEmail}`)
        onOpenChange(false)
      } else {
        toast.error("Failed to send email")
      }
    } catch (error) {
      toast.error("Failed to send email")
    }
  }

  const isLoading = companiesLoading || templatesLoading || sendingEmail

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Send Email
          </DialogTitle>
          <DialogDescription>
            Send a verification email to the customer
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Company Selection */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Company *</label>
            <Select
              value={String(selectedCompanyId)}
              onValueChange={(v) => setSelectedCompanyId(Number(v))}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a company..." />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={String(company.id)}>
                    <div className="flex items-center gap-2">
                      <span>{company.name}</span>
                      {company.template_count > 0 && (
                        <span className="text-xs text-muted-foreground">
                          ({company.template_count} templates)
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Template Selection */}
          {selectedCompanyId && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Template *</label>
              <Select
                value={String(selectedTemplateId)}
                onValueChange={(v) => setSelectedTemplateId(Number(v))}
                disabled={isLoading || templates.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={String(template.id)}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {templates.length === 0 && !templatesLoading && (
                <p className="text-xs text-muted-foreground">
                  No templates available for this company
                </p>
              )}
            </div>
          )}

          {/* Recipient Email */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Customer Email *</label>
            <Input
              type="email"
              placeholder="customer@example.com"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {/* Customer Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Customer Name</label>
            <Input
              placeholder="John Doe (optional)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Used for email greeting. Defaults to &quot;Valued Customer&quot; if empty.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={isLoading} className="gap-2">
              {isLoading ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
              {sendingEmail ? "Sending..." : "Send Email"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
