/**
 * Email Types & Interfaces
 *
 * Defines all TypeScript types for the email feature.
 */

/**
 * Company (from list endpoint)
 * Used in company dropdown
 */
export interface Company {
  id: number
  name: string
  slug: string
  logo_url: string
  primary_color: string
  secondary_color: string
  website_url: string
  template_count: number
}

/**
 * Company Details (from single endpoint)
 * Used to get branding info + available template types
 */
export interface CompanyDetails extends Company {
  from_email: string
  from_name: string
  reply_to_email: string
  support_email: string
  template_types: Array<{
    code: string
    display: string
  }>
}

export interface EmailTemplate {
  id: number
  company_id: number
  template_type: "verification_link" // For now, only support verification_link
  name: string
  subject: string
  html_body: string
  plain_text_body: string
  is_active: boolean
  is_draft: boolean
  available_variables?: Record<string, string>
}

export interface EmailLog {
  id: number
  session_uuid: string
  to_email: string
  subject: string
  status: "queued" | "sent" | "failed" | "bounced"
  template_type: string
  template_name: string
  company_name: string
  template_variables: Record<string, string>
  error_message: string | null
  provider_message_id: string | null
  sent_by_agent: string
  created_at: string
  sent_at: string | null
}

export interface SendEmailRequest {
  company_id: number
  template_id: number
  to_email: string
  customer_name?: string
  template_variables: Record<string, string>
  variables_override?: Record<string, string>
}

export interface SendEmailResponse {
  status: "queued" | "sent" | "failed"
  message: string
  email_log_id: number
}

export interface EmailHistoryResponse {
  session_uuid: string
  case_id: string
  total_emails: number
  emails: EmailLog[]
}

export interface CompaniesListResponse {
  results: Company[]
  count: number
}

export interface EmailTemplatesListResponse {
  results: EmailTemplate[]
  count: number
}
