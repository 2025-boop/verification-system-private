"""
Email Service - Ultra-Flexible Email Sending
==============================================

Provider-agnostic email service using django-anymail.
Supports: SendGrid, Mailgun, AWS SES, SMTP, and more.

Templates are fully customizable HTML - no constraints.
Agents can use variables in templates via Jinja2.

Example:
    >>> from accounts.services.email_service import EmailService
    >>> from accounts.models import Session, Company, EmailTemplate
    >>>
    >>> session = Session.objects.first()
    >>> company = Company.objects.first()
    >>> template = EmailTemplate.objects.first()
    >>>
    >>> email_log = EmailService.send_from_template(
    ...     session=session,
    ...     company=company,
    ...     template=template,
    ...     to_email='john@example.com',
    ...     template_variables={
    ...         'customer_name': 'John Doe',
    ...         'case_id': session.external_case_id,
    ...         'verification_link': 'https://app.com/verify/abc123',
    ...     },
    ...     sent_by_agent=request.user
    ... )
"""

from typing import Dict, Optional
from jinja2 import Template as Jinja2Template, TemplateSyntaxError, UndefinedError
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone
from django.core.exceptions import ObjectDoesNotExist
import logging

from accounts.models import Session, Company, EmailTemplate, EmailLog


logger = logging.getLogger(__name__)


class EmailService:
    """
    Service for sending emails with ultra-flexible, fully-custom templates.

    Templates support:
    - Raw HTML (paste from Mailchimp, Stripo, etc.)
    - Jinja2 variables: {{variable_name}}
    - Full CSS/styling support
    - No constraints on complexity

    Provider: Works with ANY email provider (SendGrid, Mailgun, SES, SMTP, etc.)
    via django-anymail abstraction layer.
    """

    # Standard variables available in all templates
    STANDARD_VARIABLES = {
        'customer_name': 'Customer name for salutation',
        'case_id': 'Verification case ID',
        'verification_link': 'Link for customer to verify',
        'stage': 'Current verification stage',
        'company_name': 'Company/brand name',
        'message': 'Custom message (optional)',
    }

    @staticmethod
    def send_verification_link(
        session: Session,
        company: Company,
        customer_email: str,
        verification_link: str,
        customer_name: str = None,
        sent_by_agent=None
    ) -> EmailLog:
        """
        Convenience method to send verification link email.

        Args:
            session: Session instance
            company: Company instance
            customer_email: Recipient email
            verification_link: Link for customer to click
            customer_name: Optional customer name
            sent_by_agent: User who initiated send

        Returns:
            EmailLog instance (status='queued' if async)
        """
        # Get the verification_link template for this company
        try:
            template = EmailTemplate.objects.get(
                company=company,
                template_type='verification_link',
                is_active=True
            )
        except ObjectDoesNotExist:
            raise ValueError(
                f"No active 'verification_link' template for {company.name}. "
                f"Create one in admin: /admin/accounts/emailtemplate/"
            )

        template_variables = {
            'customer_name': customer_name or 'Valued Customer',
            'case_id': session.external_case_id,
            'verification_link': verification_link,
            'stage': session.stage,
            'company_name': company.name,
        }

        return EmailService.send_from_template(
            session=session,
            company=company,
            template=template,
            to_email=customer_email,
            template_variables=template_variables,
            sent_by_agent=sent_by_agent
        )

    @staticmethod
    def send_stage_update(
        session: Session,
        company: Company,
        customer_email: str,
        message: str,
        customer_name: str = None,
        sent_by_agent=None
    ) -> EmailLog:
        """
        Convenience method to send stage update email.

        Args:
            session: Session instance
            company: Company instance
            customer_email: Recipient email
            message: Update message
            customer_name: Optional customer name
            sent_by_agent: User who initiated send

        Returns:
            EmailLog instance (status='queued' if async)
        """
        try:
            template = EmailTemplate.objects.get(
                company=company,
                template_type='stage_update',
                is_active=True
            )
        except ObjectDoesNotExist:
            raise ValueError(
                f"No active 'stage_update' template for {company.name}. "
                f"Create one in admin: /admin/accounts/emailtemplate/"
            )

        template_variables = {
            'customer_name': customer_name or 'Valued Customer',
            'case_id': session.external_case_id,
            'stage': session.stage,
            'message': message,
            'company_name': company.name,
        }

        return EmailService.send_from_template(
            session=session,
            company=company,
            template=template,
            to_email=customer_email,
            template_variables=template_variables,
            sent_by_agent=sent_by_agent
        )

    @staticmethod
    def send_from_template(
        session: Session,
        company: Company,
        template: EmailTemplate,
        to_email: str,
        template_variables: Dict,
        sent_by_agent=None,
        async_send: bool = True
    ) -> EmailLog:
        """
        Send email using ultra-flexible custom template with Jinja2 rendering.

        This is the core method. Templates can be ANYTHING:
        - Simple text with variables
        - Complex multi-part HTML with inline CSS
        - Responsive designs with media queries
        - Anything from email builders (Mailchimp, Stripo, etc.)

        Args:
            session: Session instance
            company: Company instance
            template: EmailTemplate instance
            to_email: Recipient email
            template_variables: Dict of {{variable}} values
            sent_by_agent: User who initiated send
            async_send: Queue with Celery (recommended) or send synchronously

        Returns:
            EmailLog instance

        Raises:
            ValueError: If template variables are invalid
            TemplateSyntaxError: If template HTML is malformed Jinja2
        """

        try:
            # Render subject line
            subject_template = Jinja2Template(template.subject)
            subject = subject_template.render(**template_variables)

            # Render HTML body
            html_template = Jinja2Template(template.html_body)
            html_body = html_template.render(**template_variables)

            # Render plain text body
            text_template = Jinja2Template(template.plain_text_body)
            plain_text_body = text_template.render(**template_variables)

        except (TemplateSyntaxError, UndefinedError) as e:
            logger.error(f"Template rendering error: {str(e)}")
            raise ValueError(f"Template error: {str(e)}")

        try:
            # Create EmailLog record (audit trail)
            email_log = EmailLog.objects.create(
                session=session,
                company=company,
                template=template,
                to_email=to_email,
                subject=subject,
                html_body=html_body,
                plain_text_body=plain_text_body,
                template_variables=template_variables,
                sent_by_agent=sent_by_agent,
                status='queued'
            )

            # Queue Celery task for async sending
            if async_send:
                # Lazy import to avoid circular dependency
                from accounts.tasks import send_email_task
                send_email_task.delay(email_log.id)
            else:
                # Execute synchronously (for testing)
                EmailService.execute_send(email_log)

            return email_log

        except Exception as e:
            logger.error(f"Failed to create EmailLog: {str(e)}")
            raise

    @staticmethod
    def execute_send(email_log: EmailLog) -> bool:
        """
        Actually send the email using the configured system backend.
        Decoupled from specific backend implementation logic.
        """
        from django.core.mail import get_connection

        try:
            company = email_log.company
            
            # Use the global system backend (DynamicEmailBackend)
            connection = get_connection()

            # Determine 'From' address logic here if needed, 
            # though DynamicEmailBackend also applies defaults.
            # We'll explicitely set it if the company has one, otherwise let backend handle it.
            from_email = None
            if company.from_email:
                if company.from_name:
                    from_email = f"{company.from_name} <{company.from_email}>"
                else:
                    from_email = company.from_email

            # Create EmailMultiAlternatives
            msg = EmailMultiAlternatives(
                subject=email_log.subject,
                body=email_log.plain_text_body,
                from_email=from_email, # If None, DynamicBackend applies default
                to=[email_log.to_email],
                connection=connection 
            )

            # Attach HTML version
            msg.attach_alternative(email_log.html_body, "text/html")

            # Attach Metadata - Safe for Anymail, ignored by others (mostly)
            # Standard Django backends ignore extra attributes on the msg object.
            # Anymail backends read them.
            msg.tags = ['verification', email_log.template.template_type]
            msg.metadata = {
                'session_uuid': str(email_log.session.uuid),
                'case_id': email_log.session.external_case_id,
                'email_log_id': str(email_log.id),
                'company': company.slug,
            }
            msg.track_opens = True
            msg.track_clicks = True

            # Send
            result = msg.send(fail_silently=False)

            # Update EmailLog
            email_log.status = 'sent'
            email_log.sent_at = timezone.now()

            # Note: Provider Message ID capture depends on the backend returning it.
            # Anymail attaches it to msg.anymail_status
            if hasattr(msg, 'anymail_status') and msg.anymail_status:
                message_id = getattr(msg.anymail_status, 'message_id', None)
                if message_id:
                    if isinstance(message_id, set):
                        email_log.provider_message_id = ', '.join(message_id)
                    else:
                        email_log.provider_message_id = str(message_id)

            email_log.save(update_fields=['status', 'sent_at', 'provider_message_id'])

            logger.info(
                f"Email sent successfully: {email_log.id} to {email_log.to_email}"
            )

            return True

        except Exception as e:
            email_log.status = 'failed'
            email_log.error_message = str(e)
            email_log.save(update_fields=['status', 'error_message'])

            logger.error(
                f"Email send failed for {email_log.id} to {email_log.to_email}: {str(e)}"
            )

            return False
