# accounts/utils.py

from django.shortcuts import get_object_or_404
from .models import Session

def get_session_or_404(session_uuid):
    """
    Unified session lookup helper.
    """
    return get_object_or_404(Session, session_uuid=session_uuid)




# ==========================
# WebSocket Broadcast Helper
# ==========================
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

def broadcast_event(event_type, payload):
    """
    Broadcast a message to all clients connected to the control_room WebSocket group.
    """
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        "control_room",   # MUST MATCH your consumer group name
        {
            "type": "broadcast.message",
            "event_type": event_type,
            "payload": payload,
        }
    )