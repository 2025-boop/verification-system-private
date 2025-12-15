import { useState, useCallback } from "react"
import { apiFetch } from "@/lib/api"
import type {
  Company,
  EmailTemplate,
  SendEmailRequest,
  SendEmailResponse,
  EmailHistoryResponse,
} from "@/lib/types/email"

/**
 * Fetch list of active companies
 */
export function useCompanies() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCompanies = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch("/api/proxy/companies")
      if (!res || !res.ok) {
        throw new Error("Failed to fetch companies")
      }
      const data = await res.json()
      // Handle both paginated and direct array responses
      const results = data.results || data
      setCompanies(Array.isArray(results) ? results : [])
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      setError(message)
      setCompanies([])
    } finally {
      setLoading(false)
    }
  }, [])

  return { companies, loading, error, fetchCompanies }
}

/**
 * Fetch email templates for a specific company
 * Filters to only verification_link templates
 */
export function useEmailTemplates(companyId?: number) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTemplates = useCallback(async (id: number) => {
    if (!id) {
      setTemplates([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/proxy/companies/${id}/templates`)
      if (!res || !res.ok) {
        throw new Error("Failed to fetch templates")
      }
      const data = await res.json()
      // Handle both paginated and direct array responses
      const results = data.results || data
      const allTemplates = Array.isArray(results) ? results : []

      // Filter to only verification_link templates
      const verificationTemplates = allTemplates.filter(
        (t) => t.template_type === "verification_link"
      )

      setTemplates(verificationTemplates)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      setError(message)
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-fetch when companyId changes
  if (companyId && templates.length === 0 && !loading) {
    fetchTemplates(companyId)
  }

  return { templates, loading, error, fetchTemplates }
}

/**
 * Send an email for a session
 */
export function useSendEmail() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendEmail = useCallback(
    async (sessionId: string, payload: SendEmailRequest): Promise<SendEmailResponse | null> => {
      setLoading(true)
      setError(null)
      try {
        const res = await apiFetch(`/api/proxy/sessions/${sessionId}/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })

        if (!res || !res.ok) {
          const errorData = await res?.json().catch(() => ({}))
          throw new Error(errorData?.error || "Failed to send email")
        }

        const data = await res.json()
        return data
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error"
        setError(message)
        return null
      } finally {
        setLoading(false)
      }
    },
    []
  )

  return { sendEmail, loading, error }
}

/**
 * Fetch email history for a session
 */
export function useEmailHistory(sessionId?: string) {
  const [history, setHistory] = useState<EmailHistoryResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchHistory = useCallback(async (id: string) => {
    if (!id) {
      setHistory(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/proxy/sessions/${id}/email-history`)
      if (!res || !res.ok) {
        throw new Error("Failed to fetch email history")
      }
      const data = await res.json()
      setHistory(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      setError(message)
      setHistory(null)
    } finally {
      setLoading(false)
    }
  }, [])

  return { history, loading, error, fetchHistory }
}

/**
 * Fetch full template details (includes subject, html_body, plain_text_body)
 * Used when a template is selected to extract variables and preview
 */
export function useTemplateDetail() {
  const [template, setTemplate] = useState<EmailTemplate | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTemplateDetail = useCallback(async (companyId: number, templateId: number) => {
    setLoading(true)
    setError(null)
    try {
      // Fetch template details including subject, html_body, plain_text_body
      const res = await apiFetch(`/api/proxy/companies/${companyId}/templates/${templateId}`)
      if (!res || !res.ok) {
        throw new Error("Failed to fetch template details")
      }
      const data = await res.json()
      setTemplate(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      setError(message)
      setTemplate(null)
    } finally {
      setLoading(false)
    }
  }, [])

  return { template, loading, error, fetchTemplateDetail }
}
