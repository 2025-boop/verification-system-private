# accounts/signals.py
"""
Django Signal Handlers for Control Room Models

This module implements signal handlers that automatically broadcast WebSocket
messages when models are created, updated, or deleted. This ensures that:

1. All database changes are reflected in real-time on the dashboard
2. Changes happen regardless of how the model was saved (API, admin, shell, etc.)
3. The system is resilient to code changes and new features

Signal handlers are registered in accounts/apps.py via the AppConfig.ready() method.

DEDUPLICATION STRATEGY:
When a model is saved via DRF ViewSet (which uses the WebSocketBroadcastMixin),
both the mixin AND this signal will fire. To prevent duplicate broadcasts, the
mixin sets instance._broadcasted_by_viewset = True, and this signal checks for
that flag and skips broadcasting if it's set.

This ensures:
- API operations: Broadcasted by mixin only (faster, more context)
- Admin/Shell operations: Broadcasted by signal (safety net)
- No duplicates: Deduplication flag prevents double-broadcasting
"""

import logging
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from accounts.models import Session, SessionLog

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Session)
def broadcast_session_save(sender, instance, created, **kwargs):
    """
    Broadcast WebSocket message when a Session is created or updated.

    This signal fires whenever a Session is saved to the database, regardless
    of whether it was saved via:
    - REST API (DRF ViewSet) - will be skipped due to deduplication
    - Django admin panel - WILL broadcast
    - Django shell - WILL broadcast
    - Legacy views - WILL broadcast
    - Celery task - WILL broadcast

    Args:
        sender: The Session model class
        instance: The Session instance being saved
        created: Boolean indicating if this is a new instance (True) or update (False)
        **kwargs: Additional signal kwargs (including 'update_fields')
    """
    # DEDUPLICATION: Skip if ViewSet already broadcasted
    if getattr(instance, '_broadcasted_by_viewset', False):
        logger.debug(f"Skipping signal broadcast for Session {instance.uuid} (already broadcast by ViewSet)")
        return

    # Determine event type
    event_type = 'session_created' if created else 'session_updated'

    # Prepare broadcast data - MATCH SessionSerializer output for consistency
    broadcast_data = {
        'type': 'broadcast_message',
        'event': event_type,
        'data': {
            # Core identifiers
            'uuid': str(instance.uuid),
            'external_case_id': instance.external_case_id,

            # Agent information
            'agent': instance.agent.id if instance.agent else None,
            'agent_username': instance.agent.username if instance.agent else None,

            # Session state
            'stage': instance.stage,
            'status': instance.status,
            'user_online': instance.user_online,

            # Rich data (CRITICAL: user_data contains current_submission & verified_data)
            'notes': instance.notes,
            'user_data': instance.user_data,

            # Timestamps
            'created_at': instance.created_at.isoformat(),
            'updated_at': instance.updated_at.isoformat(),
        }
    }

    # Send broadcast
    try:
        channel_layer = get_channel_layer()
        
        # Broadcast to global (Superusers only now)
        async_to_sync(channel_layer.group_send)(
            'control_room',
            broadcast_data
        )

        # Broadcast to specific Agent channel
        if instance.agent:
            agent_group = f"agent_{instance.agent.id}"
            async_to_sync(channel_layer.group_send)(
                agent_group,
                broadcast_data
            )
            logger.debug(f"Broadcasted session {event_type} to {agent_group}")

        logger.debug(f"Broadcasted session {event_type} for Session {instance.uuid}")
    except Exception as e:
        logger.exception(f"Failed to broadcast session {event_type} for Session {instance.uuid}: {str(e)}")


@receiver(post_delete, sender=Session)
def broadcast_session_delete(sender, instance, **kwargs):
    """
    Broadcast WebSocket message when a Session is deleted.

    This signal fires whenever a Session is deleted, regardless of whether it was
    deleted via:
    - REST API (DRF ViewSet) - will be skipped due to deduplication
    - Django admin panel - WILL broadcast
    - Django shell - WILL broadcast
    - Bulk delete operation - WILL broadcast

    Args:
        sender: The Session model class
        instance: The Session instance being deleted
        **kwargs: Additional signal kwargs
    """
    # DEDUPLICATION: Skip if ViewSet already broadcasted
    if getattr(instance, '_broadcasted_by_viewset', False):
        logger.debug(f"Skipping signal broadcast for Session {instance.uuid} deletion (already broadcast by ViewSet)")
        return

    # Prepare broadcast data
    broadcast_data = {
        'type': 'broadcast_message',
        'event': 'session_deleted',
        'data': {
            'uuid': str(instance.uuid),
            'external_case_id': instance.external_case_id,
            'agent': instance.agent.username if instance.agent else None
        }
    }

    # Send broadcast
    try:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            'control_room',
            broadcast_data
        )
        logger.debug(f"Broadcasted session deletion for Session {instance.uuid}")
    except Exception as e:
        logger.exception(f"Failed to broadcast session deletion for Session {instance.uuid}: {str(e)}")
