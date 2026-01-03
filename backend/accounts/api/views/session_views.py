# accounts/api/views/session_views.py
"""
DRF ViewSet for Session CRUD operations

Provides REST API endpoints:
- GET    /api/sessions/              - List all sessions
- POST   /api/sessions/              - Create new session
- GET    /api/sessions/{uuid}/       - Retrieve session
- PATCH  /api/sessions/{uuid}/       - Update session
- DELETE /api/sessions/{uuid}/       - Delete session

Custom Actions:
- POST   /api/sessions/{uuid}/end/   - End session
- POST   /api/sessions/{uuid}/save_notes/  - Save notes
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from accounts.api.permissions import IsStaffUser
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone

from accounts.models import Session, SessionLog
from ..serializers import (
    SessionSerializer,
    SessionListSerializer,
    SessionCreateSerializer,
    SessionUpdateSerializer,
    SaveNotesSerializer,
    BulkDeleteSerializer,
    SessionLogSerializer,
)
from ..permissions import IsSessionAgent
from ..mixins import WebSocketBroadcastMixin


class SessionViewSet(WebSocketBroadcastMixin, viewsets.ModelViewSet):
    """
    ViewSet for Session CRUD operations.

    List filtering:
    - ?status=active          - Filter by status
    - ?stage=credentials      - Filter by stage
    - ?agent=1               - Filter by agent ID

    Endpoints:
    - GET    /api/sessions/
    - POST   /api/sessions/
    - GET    /api/sessions/{uuid}/
    - PATCH  /api/sessions/{uuid}/
    - DELETE /api/sessions/{uuid}/
    - POST   /api/sessions/{uuid}/end/
    - POST   /api/sessions/{uuid}/save_notes/
    """

    queryset = Session.objects.all()
    serializer_class = SessionSerializer
    permission_classes = [IsAuthenticated, IsStaffUser]
    lookup_field = 'uuid'

    def get_queryset(self):
        """
        Filter sessions by user's agent assignment.
        Staff users see all sessions, regular users see only theirs.
        """
        user = self.request.user
        if user.is_superuser:
            queryset = Session.objects.all()
        else:
            queryset = Session.objects.filter(agent=user)

        # Allow filtering by status, stage, and agent
        status_param = self.request.query_params.get('status', None)
        if status_param:
            queryset = queryset.filter(status=status_param)

        stage_param = self.request.query_params.get('stage', None)
        if stage_param:
            queryset = queryset.filter(stage=stage_param)

        agent_param = self.request.query_params.get('agent', None)
        if agent_param and user.is_superuser:
            queryset = queryset.filter(agent_id=agent_param)

        return queryset.order_by('-updated_at')

    def get_serializer_class(self):
        """Use different serializers for different actions"""
        if self.action == 'list':
            return SessionListSerializer
        elif self.action == 'create':
            return SessionCreateSerializer
        elif self.action in ['partial_update', 'save_notes']:
            return SessionUpdateSerializer
        return SessionSerializer

    def check_object_permissions(self, request, obj):
        """Ensure user can only access their own sessions"""
        super().check_object_permissions(request, obj)
        if not request.user.is_superuser and obj.agent != request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You can only access your own sessions")

    def get_broadcast_data(self, instance, action):
        """
        Customize WebSocket broadcast data for Session operations.

        Called by WebSocketBroadcastMixin after create/update/delete.
        Sends detailed session information to WebSocket clients.

        Args:
            instance: The Session instance involved in the action
            action: String indicating the action ('created', 'updated', 'deleted')

        Returns:
            dict: WebSocket message payload
        """
        return {
            'type': 'broadcast_message',
            'event': f'session_{action}',
            'data': {
                'uuid': str(instance.uuid),
                'external_case_id': instance.external_case_id,
                'agent': instance.agent.username,
                'stage': instance.stage,
                'status': instance.status,
                'user_online': instance.user_online,
                'updated_at': instance.updated_at.isoformat()
            }
        }

    @action(detail=True, methods=['post'])
    def end(self, request, uuid=None):
        """
        End a session (custom action).

        POST /api/sessions/{uuid}/end/

        Marks session as terminated and notifies user via WebSocket.
        """
        session = self.get_object()
        self.check_object_permissions(request, session)

        # Update session status
        session.status = 'terminated'
        session._broadcasted_by_viewset = True
        session.save()

        # Log the action
        SessionLog.objects.create(
            session=session,
            message=f'Session ended by agent {request.user.username}',
            log_type='agent_action'
        )

        # Notify user via WebSocket
        try:
            async_to_sync(get_channel_layer().group_send)(
                f'session_{session.uuid}',
                {
                    'type': 'user_command',
                    'command': 'session_ended',
                    'message': 'Your session has been terminated by the agent'
                }
            )
        except Exception as e:
            # Log error but don't fail the response
            import logging
            logging.getLogger(__name__).warning(f"Failed to notify user: {str(e)}")

        # Notify control room
        try:
            async_to_sync(get_channel_layer().group_send)(
                'control_room',
                {
                    'type': 'control_message',
                    'message': f'Session {session.external_case_id} terminated'
                }
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Failed to notify control room: {str(e)}")

        return Response(
            {
                'status': 'session_ended',
                'uuid': str(session.uuid),
                'case_id': session.external_case_id
            },
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'])
    def save_notes(self, request, uuid=None):
        """
        Save agent notes for a session (custom action).

        POST /api/sessions/{uuid}/save_notes/
        Body: {"notes": "Agent's observations..."}
        """
        session = self.get_object()
        self.check_object_permissions(request, session)

        serializer = SaveNotesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        notes = serializer.validated_data.get('notes', '')
        session.notes = notes
        session._broadcasted_by_viewset = True
        session.save()

        # Log the action
        SessionLog.objects.create(
            session=session,
            message='Agent updated notes',
            log_type='agent_action',
            extra_data={'notes_length': len(notes)}
        )

        return Response(
            {
                'status': 'notes_saved',
                'notes': session.notes
            },
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        """
        Delete multiple sessions at once (collection-level action).

        POST /api/sessions/bulk-delete/
        Body: {"uuids": ["uuid1", "uuid2", ...]}

        Respects permissions:
        - Staff users can delete any sessions
        - Regular users can only delete their own sessions
        - Creates SessionLog for each deletion
        - WebSocket broadcasts automatically via signals (deduplication handled)

        Returns:
        {
            "status": "bulk_delete_completed",
            "deleted": 5,
            "failed": 1,
            "results": [
                {"uuid": "...", "status": "deleted"},
                {"uuid": "...", "status": "deleted"},
                {"uuid": "...", "status": "permission_denied"}
            ]
        }
        """
        # Validate request data
        serializer = BulkDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uuids = serializer.validated_data['uuids']
        results = []
        deleted_count = 0
        failed_count = 0

        # Get sessions for deletion
        user = request.user
        sessions_to_delete = Session.objects.filter(uuid__in=uuids)

        # Log the bulk delete operation
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Bulk delete initiated by {user.username} for {len(uuids)} sessions")

        for session in sessions_to_delete:
            try:
                # Permission check: only staff can delete others' sessions
                if not user.is_superuser and session.agent != user:
                    results.append({
                        "uuid": str(session.uuid),
                        "status": "permission_denied",
                        "message": "You can only delete your own sessions"
                    })
                    failed_count += 1
                    logger.warning(
                        f"Bulk delete permission denied for {user.username} on session {session.uuid}"
                    )
                    continue

                # Create log entry before deletion
                session_case_id = session.external_case_id
                SessionLog.objects.create(
                    session=session,
                    message=f'Session deleted in bulk by agent {user.username}',
                    log_type='agent_action'
                )

                # Delete the session
                # Signal handler will auto-broadcast the deletion
                session.delete()

                results.append({
                    "uuid": str(session.uuid),
                    "status": "deleted",
                    "case_id": session_case_id
                })
                deleted_count += 1
                logger.info(f"Bulk deleted session {session.uuid} ({session_case_id})")

            except Exception as e:
                results.append({
                    "uuid": str(session.uuid),
                    "status": "error",
                    "message": str(e)
                })
                failed_count += 1
                logger.exception(f"Error deleting session {session.uuid} in bulk: {str(e)}")

        # Handle UUIDs that don't exist
        found_uuids = set(str(s.uuid) for s in sessions_to_delete)
        requested_uuids = set(str(u) for u in uuids)
        missing_uuids = requested_uuids - found_uuids

        for uuid in missing_uuids:
            results.append({
                "uuid": uuid,
                "status": "not_found",
                "message": "Session does not exist"
            })
            failed_count += 1

        logger.info(
            f"Bulk delete completed: {deleted_count} deleted, {failed_count} failed "
            f"(out of {len(uuids)} requested)"
        )

        return Response(
            {
                "status": "bulk_delete_completed",
                "deleted": deleted_count,
                "failed": failed_count,
                "total": len(uuids),
                "results": results
            },
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['get'], url_path='logs')
    def logs(self, request, uuid=None):
        """
        Retrieve session logs with pagination and filtering.

        GET /api/sessions/{uuid}/logs/
        Query params:
        - ?limit=50        - Number of logs per page (default: 50)
        - ?offset=0        - Pagination offset (default: 0)
        - ?category=agent_action - Filter by log type (optional)

        Returns paginated SessionLog objects in reverse chronological order.
        """
        session = self.get_object()
        self.check_object_permissions(request, session)

        # Get logs for this session
        logs_queryset = SessionLog.objects.filter(session=session).order_by('-created_at')

        # Optional filtering by log_type/category
        category = request.query_params.get('category')
        if category:
            logs_queryset = logs_queryset.filter(log_type=category)

        # Pagination
        paginator = PageNumberPagination()
        paginator.page_size = int(request.query_params.get('limit', 50))
        paginated_logs = paginator.paginate_queryset(logs_queryset, request)

        serializer = SessionLogSerializer(paginated_logs, many=True)
        return Response({
            'results': serializer.data,
            'count': paginator.page.paginator.count,
            'next': paginator.get_next_link(),
            'previous': paginator.get_previous_link(),
        })

    def perform_create(self, serializer):
        """Override to ensure agent is set to current user"""
        serializer.save()

    def perform_destroy(self, instance):
        """
        Delete a session. Log the deletion.
        """
        session_id = str(instance.uuid)
        session_case_id = instance.external_case_id

        SessionLog.objects.create(
            session=instance,
            message=f'Session deleted by agent {self.request.user.username}',
            log_type='agent_action'
        )

        super().perform_destroy(instance)

        # Notify control room
        try:
            async_to_sync(get_channel_layer().group_send)(
                'control_room',
                {
                    'type': 'control_message',
                    'message': f'Session {session_case_id} deleted'
                }
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Failed to notify control room: {str(e)}")
