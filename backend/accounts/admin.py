# accounts/admin.py
from django.contrib import admin
from django.contrib import admin
from .models import Session, SessionLog, Company, EmailTemplate, EmailLog, SystemSettings, EmailSettings
from django.urls import reverse
from django.utils.html import format_html
from django.http import HttpResponseRedirect

@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display = ('external_case_id', 'agent', 'status', 'stage', 'user_online', 'created_at')
    search_fields = ('external_case_id', 'agent__username', 'status', 'stage')
    list_filter = ('status', 'stage', 'user_online', 'created_at')
    ordering = ('-created_at',)

@admin.register(SessionLog)
class SessionLogAdmin(admin.ModelAdmin):
    list_display = ('session', 'log_type', 'message', 'created_at')
    search_fields = ('session__external_case_id', 'message', 'log_type')
    list_filter = ('log_type', 'created_at')
    ordering = ('-created_at',)


# ==========================
# EMAIL ADMIN REGISTRATION
# ==========================

@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    """Admin interface for managing companies and their email configuration"""

    list_display = ['name', 'from_email', 'primary_color', 'is_active']
    search_fields = ['name', 'from_email', 'slug']
    list_filter = ['is_active', 'created_at']
    prepopulated_fields = {'slug': ('name',)}

    fieldsets = (
        ('Identity', {
            'fields': ('name', 'slug', 'is_active')
        }),
        ('Branding', {
            'fields': ('logo_url', 'primary_color', 'secondary_color', 'website_url'),
            'description': 'Colors in hex format (e.g., #0073E6). URLs available in templates.'
        }),
        ('Email Configuration', {
            'fields': ('from_email', 'from_name', 'reply_to_email'),
            'description': 'from_email & from_name used in all emails from this company'
        }),
        ('Support', {
            'fields': ('support_email', 'support_phone'),
            'description': 'Contact info available in templates'
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    readonly_fields = ['created_at', 'updated_at']


@admin.register(EmailTemplate)
class EmailTemplateAdmin(admin.ModelAdmin):
    """Admin interface for managing email templates - ultra-flexible, copy-paste HTML"""

    list_display = ['company', 'template_type', 'name', 'is_active', 'is_draft']
    search_fields = ['company__name', 'name', 'subject', 'template_type']
    list_filter = ['template_type', 'company', 'is_active', 'is_draft', 'created_at']

    fieldsets = (
        ('Template Info', {
            'fields': ('company', 'template_type', 'name', 'description', 'is_active', 'is_draft')
        }),
        ('Email Content', {
            'fields': ('subject', 'html_body', 'plain_text_body'),
            'description': (
                'Full custom HTML & text. Paste from email builders (Mailchimp, Stripo, etc). '
                'Use {{variables}}: customer_name, case_id, verification_link, stage, company_name, message'
            ),
            'classes': ('wide',)
        }),
        ('Metadata', {
            'fields': ('available_variables', 'created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    readonly_fields = ['created_at', 'updated_at']


@admin.register(EmailLog)
class EmailLogAdmin(admin.ModelAdmin):
    """Admin interface for viewing email history and debugging delivery issues"""

    list_display = ['to_email', 'subject', 'status', 'template_link', 'sent_by_agent', 'sent_at']
    search_fields = ['to_email', 'subject', 'session__external_case_id', 'company__name']
    list_filter = ['status', 'company', 'created_at', 'sent_at']

    fieldsets = (
        ('Email Information', {
            'fields': ('session', 'company', 'template', 'to_email', 'subject')
        }),
        ('Content', {
            'fields': ('html_body', 'plain_text_body'),
            'classes': ('collapse',),
        }),
        ('Status & Delivery', {
            'fields': ('status', 'provider_message_id', 'error_message', 'sent_by_agent')
        }),
        ('Template Variables', {
            'fields': ('template_variables',),
            'classes': ('collapse',),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'sent_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    readonly_fields = ['created_at', 'sent_at', 'updated_at', 'template_variables']

    def template_link(self, obj):
        """Display template type as friendly name"""
        if obj.template:
            return obj.template.template_type
        return '-'
    template_link.short_description = 'Template Type'


@admin.register(SystemSettings)
class SystemSettingsAdmin(admin.ModelAdmin):
    """
    Singleton admin interface.
    Redirects to the single instance if it exists, or listing if not.
    """
    def has_add_permission(self, request):
        # Only allow adding if no instance exists
        return not SystemSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        # Prevent deleting the configuration
        return False

    def changelist_view(self, request, extra_context=None):
        # Redirect directly to the edit page of the first instance
        obj, created = SystemSettings.objects.get_or_create(pk=1)
        return HttpResponseRedirect(
            reverse('admin:accounts_systemsettings_change', args=[obj.pk])
        )

    fieldsets = (
        ('KYC Configuration', {
            'fields': ('kyc_redirect_url',),
            'description': 'The external URL where users are sent to complete identity verification.'
        }),
        ('System Control', {
            'fields': ('maintenance_mode', 'max_daily_verifications'),
            'description': 'Emergency controls and safety caps.'
        }),
        ('Global Support Info', {
            'fields': ('support_phone', 'support_email'),
            'description': 'Contact details shown to users across the platform.'
        }),
    )


@admin.register(EmailSettings)
class EmailSettingsAdmin(admin.ModelAdmin):
    """
    Singleton admin for dynamic email configuration.
    Allows switching providers and updating keys without code changes.
    """
    def has_add_permission(self, request):
        return not EmailSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

    def changelist_view(self, request, extra_context=None):
        obj, created = EmailSettings.objects.get_or_create(pk=1)
        return HttpResponseRedirect(
            reverse('admin:accounts_emailsettings_change', args=[obj.pk])
        )

    fieldsets = (
        ('Active Provider', {
            'fields': ('email_provider',),
            'description': 'Select which service provider to use for sending emails.'
        }),
        ('Sender Defaults', {
            'fields': ('default_from_email', 'from_name'),
            'description': 'Global defaults used if Company-level settings are missing.'
        }),
        ('Twilio SendGrid', {
            'fields': ('sendgrid_api_key',),
            'classes': ('collapse',),
            'description': 'Required if provider is SendGrid.'
        }),
        ('Mailgun', {
            'fields': ('mailgun_api_key', 'mailgun_sender_domain'),
            'classes': ('collapse',),
        }),
        ('Amazon SES', {
            'fields': ('aws_access_key_id', 'aws_secret_access_key', 'aws_region'),
            'classes': ('collapse',),
        }),
        ('Mailjet', {
            'fields': ('mailjet_api_key', 'mailjet_secret_key'),
            'classes': ('collapse',),
        }),
        ('Custom SMTP', {
            'fields': (
                'smtp_host', 'smtp_port', 'smtp_username', 'smtp_password',
                'smtp_use_tls', 'smtp_use_ssl'
            ),
            'classes': ('collapse',),
        }),
    )

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        # Mask API keys in admin (basic precaution)
        # Note: This makes them look like passwords but doesn't encrypt them in DB
        sensitive_fields = [
            'sendgrid_api_key', 'mailgun_api_key',
            'aws_secret_access_key', 'mailjet_secret_key', 'smtp_password'
        ]
        from django import forms
        for field in sensitive_fields:
            if field in form.base_fields:
                form.base_fields[field].widget = forms.PasswordInput(render_value=True)
        return form
