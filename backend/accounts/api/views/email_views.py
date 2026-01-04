"""
Email API Endpoints
===================

REST API endpoints for agents to send emails and view history.

Endpoints:
- POST /api/sessions/{uuid}/send-email/       - Send email to customer
- GET  /api/sessions/{uuid}/email-history/    - View email history for session
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
import logging

from accounts.models import Session, EmailLog, Company, EmailTemplate
from accounts.api.serializers import SendEmailSerializer, EmailLogSerializer
from accounts.api.permissions import IsStaffUser
from accounts.services.email_service import EmailService


logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsStaffUser])
def send_email(request, session_uuid):
    """
    Send email to customer for a session.

    POST /api/sessions/{uuid}/send-email/

    Request body:
    {
        "company_id": 1,
        "template_id": 5,
        "to_email": "john@example.com",
        "customer_name": "John Doe",  (optional)
        "template_variables": {
            "verification_link": "https://app.com/verify/abc123"
        },
        "variables_override": {  (optional - agent customization)
            "verification_link": "https://custom.com"
        }
    }

    Response:
    {
        "status": "queued",
        "message": "Email queued to john@example.com",
        "email_log_id": 42
    }

    Errors:
    - 404: Session not found
    - 400: Invalid request or template not found
    - 500: Unexpected error
    """

    # Get session
    session = get_object_or_404(Session, uuid=session_uuid)

    # Permission check: only session owner or superuser
    if not request.user.is_superuser and session.agent != request.user:
        return Response(
            {'error': 'You can only send emails for your own sessions'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Validate request
    serializer = SendEmailSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    try:
        # Get company and template
        company = get_object_or_404(Company, id=serializer.validated_data['company_id'])

        template = get_object_or_404(
            EmailTemplate,
            id=serializer.validated_data['template_id'],
            company=company,
            is_active=True
        )

        # Build template variables - AUTO-POPULATE from Company/Session
        # Industry standard: Agent only provides customer email/name, rest is automatic
        customer_name = serializer.validated_data.get('customer_name', 'Valued Customer')
        
        template_variables = {
            # Standard variables - auto-populated
            'customer_name': customer_name,
            'case_id': session.external_case_id or '',
            'verification_link': company.website_url or '',  # Use company's landing page URL
            'stage': session.stage or '',
            'company_name': company.name,
            'message': '',  # Optional, can be overridden
        }
        
        # Allow frontend to pass additional/override variables if needed (backwards compat)
        frontend_variables = serializer.validated_data.get('template_variables', {})
        if frontend_variables:
            template_variables.update(frontend_variables)
        
        variables_override = serializer.validated_data.get('variables_override', {})
        template_variables.update(variables_override)

        # Send email (async via Celery)
        email_log = EmailService.send_from_template(
            session=session,
            company=company,
            template=template,
            to_email=serializer.validated_data['to_email'],
            template_variables=template_variables,
            sent_by_agent=request.user,
            async_send=True  # Always async - never block HTTP response
        )

        # Broadcast to WebSocket (agent dashboard real-time update)
        try:
            async_to_sync(get_channel_layer().group_send)(
                'control_room',
                {
                    'type': 'broadcast_message',
                    'event': 'email_queued',
                    'data': {
                        'session_uuid': str(session.uuid),
                        'case_id': session.external_case_id,
                        'to_email': email_log.to_email,
                        'template_type': template.template_type,
                        'template_name': template.name,
                        'status': email_log.status,
                        'company_name': company.name,
                    }
                }
            )
        except Exception as e:
            logger.warning(f"Failed to broadcast email event to WebSocket: {str(e)}")

        return Response(
            {
                'status': 'queued',
                'message': f'Email queued to {email_log.to_email}',
                'email_log_id': email_log.id,
            },
            status=status.HTTP_201_CREATED
        )

    except ObjectDoesNotExist as e:
        return Response(
            {'error': 'Company or template not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    except ValueError as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )

    except Exception as e:
        logger.error(f"Email send error: {str(e)}")
        return Response(
            {'error': 'Failed to queue email'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsStaffUser])
def email_history(request, session_uuid):
    """
    Get email history for a session.

    GET /api/sessions/{uuid}/email-history/

    Query parameters:
    - ?limit=20      (default: all)
    - ?status=sent   (filter by status)

    Response:
    {
        "session_uuid": "abc-123-def",
        "case_id": "CIBC12345678",
        "total_emails": 5,
        "emails": [
            {
                "id": 42,
                "to_email": "john@example.com",
                "subject": "CIBC12345678 - Verify Your Identity",
                "status": "sent",
                "template_type": "verification_link",
                "template_display": "Verification Link - Initial Kick-off",
                "created_at": "2025-12-02T10:30:00Z",
                "sent_at": "2025-12-02T10:30:05Z",
                "error_message": "",
                "sent_by_agent": "john_agent"
            },
            ...
        ]
    }

    Errors:
    - 404: Session not found
    """

    session = get_object_or_404(Session, uuid=session_uuid)

    # Permission check: only session owner or superuser
    if not request.user.is_superuser and session.agent != request.user:
        return Response(
            {'error': 'You can only view email history for your own sessions'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Get emails for this session
    queryset = EmailLog.objects.filter(session=session).order_by('-created_at')

    # Optional: filter by status
    status_filter = request.query_params.get('status')
    if status_filter:
        queryset = queryset.filter(status=status_filter)

    # Optional: limit results
    limit = request.query_params.get('limit')
    if limit:
        try:
            queryset = queryset[:int(limit)]
        except (ValueError, TypeError):
            pass

    emails = list(queryset)
    serializer = EmailLogSerializer(emails, many=True)

    return Response({
        'session_uuid': str(session.uuid),
        'case_id': session.external_case_id,
        'total_emails': len(emails),
        'emails': serializer.data
    })


# Import guard - avoid circular imports
from django.core.exceptions import ObjectDoesNotExist
