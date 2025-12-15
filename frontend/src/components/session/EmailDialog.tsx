"use client"

import { useState, useEffect, useMemo } from "react"
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Loader, Mail, ChevronDown, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { useCompanies, useEmailTemplates, useSendEmail, useTemplateDetail } from "@/lib/hooks/useEmail"
import type { SessionData } from "@/lib/stores/sessionStore"

interface EmailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
  session?: SessionData
}

const STANDARD_VARIABLES = {
  customer_name: "Customer name",
  case_id: "Case ID",
  verification_link: "Verification link",
  message: "Custom message",
  company_name: "Company name",
}

export function EmailDialog({ open, onOpenChange, sessionId, session }: EmailDialogProps) {
  // Form state
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | "">("")
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | "">("")
  const [toEmail, setToEmail] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [variables, setVariables] = useState<Record<string, string>>({})
  const [variablesOpen, setVariablesOpen] = useState(false)

  // Data fetching
  const { companies, loading: companiesLoading, fetchCompanies } = useCompanies()
  const { templates, loading: templatesLoading, fetchTemplates } = useEmailTemplates()
  const { sendEmail, loading: sendingEmail } = useSendEmail()
  const { template: fullTemplate, loading: fetchingTemplateDetail, fetchTemplateDetail } = useTemplateDetail()

  // Use full template details (with subject, html_body) instead of list summary
  const selectedTemplate = fullTemplate

  // Parse template variables from subject and html_body
  const templateVariables = useMemo(() => {
    if (!selectedTemplate) return []

    const variableRegex = /\{\{(\w+)\}\}/g
    const found = new Set<string>()

    const addMatches = (text: string) => {
      if (!text) return // Skip if text is empty or undefined
      let match
      while ((match = variableRegex.exec(text)) !== null) {
        found.add(match[1])
      }
    }

    addMatches(selectedTemplate.subject || "")
    addMatches(selectedTemplate.html_body || "")
    addMatches(selectedTemplate.plain_text_body || "")

    return Array.from(found).sort()
  }, [selectedTemplate])

  // Initialize form when dialog opens
  useEffect(() => {
    if (open) {
      fetchCompanies()
      // Pre-fill variables from session data
      if (session) {
        setVariables((prev) => ({
          ...prev,
          case_id: session.external_case_id || "",
        }))
      }
    }
  }, [open, session, fetchCompanies])

  // Fetch templates and pre-fill company name when company is selected
  useEffect(() => {
    if (selectedCompanyId) {
      fetchTemplates(selectedCompanyId as number)
      setSelectedTemplateId("") // Clear template selection when company changes

      // Pre-fill company_name variable
      const selectedCompany = companies.find((c) => c.id === selectedCompanyId)
      if (selectedCompany) {
        setVariables((prev) => ({
          ...prev,
          company_name: selectedCompany.name,
        }))
      }
    }
  }, [selectedCompanyId, fetchTemplates, companies])

  // Fetch full template details when template is selected
  useEffect(() => {
    if (selectedCompanyId && selectedTemplateId) {
      fetchTemplateDetail(selectedCompanyId as number, selectedTemplateId as number)
    }
  }, [selectedTemplateId, selectedCompanyId, fetchTemplateDetail])

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

    // All template variables are optional - backend pre-fills from template configuration
    // Agents can override any variable if needed

    try {
      // Build request payload
      const templateVars = {
        ...variables,
        customer_name: customerName || "Valued Customer",
        company_name: companies.find((c) => c.id === selectedCompanyId)?.name || "",
      }

      const payload = {
        company_id: selectedCompanyId as number,
        template_id: selectedTemplateId as number,
        to_email: toEmail,
        customer_name: customerName || undefined,
        template_variables: templateVars,
      }

      const result = await sendEmail(sessionId, payload)

      if (result) {
        toast.success(`Email queued to ${toEmail}`)
        // Reset form
        setSelectedCompanyId("")
        setSelectedTemplateId("")
        setToEmail("")
        setCustomerName("")
        setVariables({})
        onOpenChange(false)
      } else {
        toast.error("Failed to send email")
      }
    } catch (error) {
      toast.error("Failed to send email")
    }
  }

  const isLoading = companiesLoading || templatesLoading || sendingEmail || fetchingTemplateDetail

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Send Email
          </DialogTitle>
          <DialogDescription>
            Send a verification link email to the customer
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Company Selection */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Company</label>
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
                          ({company.template_count})
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
              <label className="text-sm font-medium">Template</label>
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
            </div>
          )}

          {/* Recipient Email */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">To Email *</label>
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
              placeholder="John Doe"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {/* Template Variables - Collapsible */}
          {selectedTemplate && templateVariables.length > 0 && (
            <Collapsible open={variablesOpen} onOpenChange={setVariablesOpen} className="border-t pt-4">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between hover:bg-muted/50"
                >
                  <span className="text-sm font-medium">Email Variables</span>
                  {variablesOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <div className="space-y-3">
                  {templateVariables.map((varName) => {
                    return (
                      <div key={varName} className="space-y-1.5">
                        <label className="text-sm">
                          {STANDARD_VARIABLES[varName as keyof typeof STANDARD_VARIABLES] || varName}
                        </label>
                        <Input
                          placeholder={
                            varName === "verification_link"
                              ? "https://example.com/verify/abc123"
                              : `Enter ${varName}`
                          }
                          value={variables[varName] || ""}
                          onChange={(e) =>
                            setVariables((prev) => ({
                              ...prev,
                              [varName]: e.target.value,
                            }))
                          }
                          disabled={isLoading}
                        />
                      </div>
                    )
                  })}
                </div>

                {/* Template Preview */}
                <div className="border-t mt-4 pt-4">
                  <p className="text-sm font-medium mb-2">Subject Preview</p>
                  <div className="p-2 bg-muted rounded text-sm wrap-break-word">
                    {selectedTemplate.subject
                      .replace(/\{\{(\w+)\}\}/g, (_, varName) => variables[varName] || `{{${varName}}}`)
                      .substring(0, 100)}
                    {selectedTemplate.subject.length > 100 ? "..." : ""}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

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
