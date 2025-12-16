# accounts/admin.py
from django.contrib import admin
from django.contrib import admin
from .models import Session, SessionLog, Company, EmailTemplate, EmailLog, SystemSettings, EmailSettings
from django.urls import reverse
from django.utils.html import format_html
from django.http import HttpResponseRedirect

# ==========================
# INLINES (Consolidation Layer)
# ==========================

class EmailTemplateInline(admin.TabularInline):
    """Manage templates directly inside the Company view"""
    model = EmailTemplate
    fields = ('name', 'template_type', 'subject', 'is_active', 'is_draft')
    extra = 0
    show_change_link = True
    classes = ('collapse',)

class SessionLogInline(admin.TabularInline):
    """View session history directly inside the Session view"""
    model = SessionLog
    fields = ('created_at', 'log_type', 'message')
    readonly_fields = ('created_at', 'log_type', 'message')
    can_delete = False
    extra = 0
    max_num = 0
    classes = ('collapse',)

class EmailLogInline(admin.TabularInline):
    """View sent emails directly inside the Session view"""
    model = EmailLog
    fields = ('sent_at', 'subject', 'status_colored')
    readonly_fields = ('sent_at', 'subject', 'status_colored')
    can_delete = False
    extra = 0
    max_num = 0
    classes = ('collapse',)

    def status_colored(self, obj):
        colors = {
            'sent': 'green', 'opened': 'green', 'clicked': 'green',
            'failed': 'red', 'bounced': 'red',
            'queued': 'orange'
        }
        color = colors.get(obj.status, 'black')
        return format_html('<span style="color: {}; font-weight: bold;">{}</span>', color, obj.get_status_display())
    status_colored.short_description = 'Status'


# ==========================
# CORE ADMIN REGISTRATION
# ==========================

# ==========================
# BRANDING
# ==========================
admin.site.site_header = "Control Room Admin"
admin.site.site_title = "Control Room"
admin.site.index_title = "Mission Control"


@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    """
    Session Cockpit: COMPLETE view of a user's journey.
    """
    list_display = ('external_case_id', 'agent', 'status_colored', 'stage', 'user_online', 'created_at')
    search_fields = ('external_case_id', 'agent__username', 'user_email', 'user_name')
    list_filter = ('status', 'stage', 'user_online', 'created_at')
    ordering = ('-created_at',)
    
    inlines = [SessionLogInline, EmailLogInline]
    
    fieldsets = (
        ('Case Management', {
            'fields': ('external_case_id', 'status', 'stage', 'agent'),
            'description': 'Core tracking info for the verification session.'
        }),
        ('Customer Identity', {
            'fields': ('user_name', 'user_email', 'user_online'),
        }),
        ('Data & Notes', {
            'fields': ('notes', 'user_data', 'uuid'),
            'classes': ('collapse',),
            'description': 'Technical metadata and internal notes.'
        }),
    )

    def status_colored(self, obj):
        colors = {
            'active': 'green', 'completed': 'blue',
            'failed': 'red', 'terminated': 'red'
        }
        color = colors.get(obj.status, 'black')
        return format_html('<span style="color: {}; font-weight: bold;">{}</span>', color, obj.get_status_display())
    status_colored.short_description = 'Status'


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    """
    Company Hub: Manage Branding & Templates in one place.
    """
    list_display = ['logo_preview', 'name', 'from_email', 'color_preview', 'is_active']
    search_fields = ['name', 'from_email', 'slug']
    list_filter = ['is_active', 'created_at']
    prepopulated_fields = {'slug': ('name',)}
    
    inlines = [EmailTemplateInline]

    fieldsets = (
        ('Identity', {
            'fields': ('name', 'slug', 'is_active')
        }),
        ('Branding', {
            'fields': (
                ('logo_url', 'logo_preview'),
                ('primary_color', 'color_preview'), 
                'secondary_color', 
                'website_url'
            ),
            'description': 'Configure visuals. Logo preview appears if valid URL is provided.'
        }),
        ('Email Configuration', {
            'fields': ('from_email', 'from_name', 'reply_to_email'),
            'description': 'Default sender info for this company.'
        }),
        ('Support Information', {
            'fields': ('support_email', 'support_phone'),
            'description': 'Contact info available in templates.'
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    readonly_fields = ['logo_preview', 'color_preview', 'created_at', 'updated_at']

    def logo_preview(self, obj):
        if obj.logo_url:
            return format_html('<img src="{}" style="height: 30px; max-width: 100px; object-fit: contain;" />', obj.logo_url)
        return "-"
    logo_preview.short_description = "Logo"

    def color_preview(self, obj):
        if obj.primary_color:
            return format_html(
                '<div style="width: 20px; height: 20px; background-color: {}; border: 1px solid #ccc;"></div>', 
                obj.primary_color
            )
        return "-"
    color_preview.short_description = "Color"


@admin.register(EmailTemplate)
class EmailTemplateAdmin(admin.ModelAdmin):
    """
    Design Studio: Focused editor for email content.
    """
    list_display = ['name', 'company', 'template_type', 'is_active', 'is_draft']
    search_fields = ['company__name', 'name', 'subject']
    list_filter = ['company', 'template_type', 'is_active', 'is_draft']
    save_as = True  # Allows "Save as new" for easy cloning

    fieldsets = (
        ('Publishing', {
            'fields': (('is_active', 'is_draft'),),
            'description': 'Control visibility and draft status.'
        }),
        ('Context', {
            'fields': ('company', 'template_type', 'name', 'description'),
        }),
        ('Design Canvas', {
            'fields': ('subject', 'html_body', 'plain_text_body'),
            'description': 'Full custom HTML. Use the variables below.',
            'classes': ('wide',)
        }),
        ('Reference', {
            'fields': ('available_variables',),
            'classes': ('collapse',),
            'description': 'Variables available for this template type.'
        }),
    )
    
    readonly_fields = ['available_variables', 'created_at', 'updated_at']


@admin.register(EmailLog)
class EmailLogAdmin(admin.ModelAdmin):
    """
    Email Audit Trail. Hidden from main index to reduce clutter.
    Accessible via Session Cockpit.
    """
    # Hide from Admin Index
    def has_module_permission(self, request):
        return False

    list_display = ['status_colored', 'to_email', 'subject', 'company', 'sent_at']
    search_fields = ['to_email', 'subject', 'company__name']
    list_filter = ['status', 'company', 'sent_at']

    fieldsets = (
        ('Delivery Status', {
            'fields': ('status', 'status_colored_large', 'error_message', 'provider_message_id'),
        }),
        ('Overview', {
            'fields': ('to_email', 'subject', 'sent_at', 'sent_by_agent'),
        }),
        ('Context', {
            'fields': ('session', 'company', 'template'),
        }),
        ('Content', {
            'fields': ('html_body', 'plain_text_body'),
            'classes': ('collapse',),
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at', 'template_variables'),
            'classes': ('collapse',),
        }),
    )

    readonly_fields = ['status_colored_large', 'created_at', 'sent_at', 'updated_at', 'template_variables']

    def status_colored(self, obj):
        colors = {
            'sent': 'green', 'opened': 'green', 'clicked': 'green',
            'failed': 'red', 'bounced': 'red',
            'queued': 'orange'
        }
        color = colors.get(obj.status, 'black')
        return format_html('<span style="color: {}; font-weight: bold;">{}</span>', color, obj.get_status_display())
    status_colored.short_description = 'Status'

    def status_colored_large(self, obj):
        colors = {
            'sent': 'green', 'opened': 'green', 'clicked': 'green',
            'failed': 'red', 'bounced': 'red',
            'queued': 'orange'
        }
        color = colors.get(obj.status, 'black')
        return format_html('<h2 style="color: {}; margin: 0;">{}</h2>', color, obj.get_status_display())
    status_colored_large.short_description = 'Status Visual'


@admin.register(SessionLog)
class SessionLogAdmin(admin.ModelAdmin):
    # Hide from Admin Index
    def has_module_permission(self, request):
        return False

    list_display = ('created_at', 'log_type', 'session_link', 'message')
    search_fields = ('session__external_case_id', 'message')
    list_filter = ('log_type', 'created_at')
    
    def session_link(self, obj):
        return obj.session.external_case_id or obj.session.uuid
    session_link.short_description = "Session"


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
        ('Global Configuration', {
            'fields': ('default_from_email', 'from_name', 'webhook_secret'),
            'description': 'Global defaults and shared secrets (used by Brevo/SparkPost webhooks).'
        }),
        ('Brevo (Sendinblue)', {
            'fields': ('brevo_api_key',),
            'classes': ('collapse',),
            'description': 'Required if provider is Brevo.'
        }),
        ('Twilio SendGrid', {
            'fields': ('sendgrid_api_key', 'sendgrid_webhook_verification_key'),
            'classes': ('collapse',),
            'description': 'Required if provider is SendGrid.'
        }),
        ('Mailgun', {
            'fields': ('mailgun_api_key', 'mailgun_sender_domain', 'mailgun_webhook_signing_key'),
            'classes': ('collapse',),
        }),
        ('Postmark', {
            'fields': ('postmark_server_token', 'postmark_account_token'),
            'classes': ('collapse',),
        }),
        ('SparkPost', {
            'fields': ('sparkpost_api_key',),
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
        # Mask API keys in admin
        sensitive_fields = [
            'sendgrid_api_key', 'sendgrid_webhook_verification_key',
            'mailgun_api_key', 'mailgun_webhook_signing_key',
            'aws_secret_access_key', 
            'mailjet_secret_key', 
            'smtp_password',
            'brevo_api_key',
            'sparkpost_api_key',
            'postmark_server_token', 'postmark_account_token',
            'webhook_secret'
        ]
        from django import forms
        for field in sensitive_fields:
            if field in form.base_fields:
                form.base_fields[field].widget = forms.PasswordInput(render_value=True)
        return form
