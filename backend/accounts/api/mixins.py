# accounts/api/mixins.py
"""
WebSocket Broadcasting Mixins for DRF ViewSets

This mixin automatically broadcasts WebSocket messages when models are created,
updated, or deleted via DRF ViewSets. This ensures real-time updates across all
connected WebSocket clients.

Usage:
    class MyViewSet(WebSocketBroadcastMixin, viewsets.ModelViewSet):
        queryset = MyModel.objects.all()
        serializer_class = MySerializer

        def get_broadcast_data(self, instance, action):
            return {
                'type': 'broadcast_message',
                'event': f'my_model_{action}',
                'data': {'id': instance.pk}
            }
"""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


class WebSocketBroadcastMixin:
    """
    Mixin for DRF ViewSets to automatically broadcast WebSocket messages
    on create, update, and destroy operations.

    This mixin hooks into DRF's perform_* methods to send WebSocket
    broadcasts to connected clients without requiring manual handling
    in each view.

    Subclasses should override:
    - get_broadcast_group(): Change the broadcast group (default: 'control_room')
    - get_broadcast_data(): Customize the broadcast message payload

    Features:
    - Automatic broadcasting on CRUD operations
    - Deduplication: Prevents double-broadcasts from signals
    - Customizable: Override methods to change behavior
    - DRY: Write once, use across all ViewSets
    """

    def get_broadcast_group(self):
        """
        Get the WebSocket group to broadcast to.

        Override this to broadcast to different groups based on the operation
        or model type.

        Returns:
            str: Name of the channel group (default: 'control_room')
        """
        return 'control_room'

    def get_broadcast_data(self, instance, action):
        """
        Get the WebSocket broadcast message payload.

        Override this method in subclasses to customize what data is sent
        to WebSocket clients. Called after each CRUD operation.

        Args:
            instance: The model instance that was created/updated/deleted
            action: String indicating the action ('created', 'updated', 'deleted')

        Returns:
            dict: WebSocket message payload with 'type', 'event', and 'data' keys
        """
        return {
            'type': 'broadcast_message',
            'event': f'{self.basename}_{action}',
            'data': {
                'id': instance.pk if hasattr(instance, 'pk') else str(instance)
            }
        }

    def perform_create(self, serializer):
        """
        Override DRF's perform_create to broadcast after creation.

        This is called by DRF after validation but before response.
        We save the instance and immediately broadcast to WebSocket clients.
        """
        instance = serializer.save()

        # Mark instance as broadcasted by ViewSet to prevent signal from
        # also broadcasting (deduplication strategy)
        instance._broadcasted_by_viewset = True

        self._broadcast(instance, 'created')

    def perform_update(self, serializer):
        """
        Override DRF's perform_update to broadcast after update.

        This is called by DRF after validation but before response.
        We save the instance and immediately broadcast to WebSocket clients.
        """
        instance = serializer.save()

        # Mark instance as broadcasted by ViewSet to prevent signal from
        # also broadcasting (deduplication strategy)
        instance._broadcasted_by_viewset = True

        self._broadcast(instance, 'updated')

    def perform_destroy(self, instance):
        """
        Override DRF's perform_destroy to broadcast before deletion.
        """
        # Capture agent ID before deletion for group routing
        agent_id = instance.agent.id if hasattr(instance, 'agent') and instance.agent else None
        
        # Get broadcast data BEFORE deletion
        broadcast_data = self.get_broadcast_data(instance, 'deleted')

        # Mark to prevent signal from broadcasting
        instance._broadcasted_by_viewset = True

        # Delete the instance
        super().perform_destroy(instance)

        # Broadcast after deletion
        groups = ['control_room']
        if agent_id:
            groups.append(f"agent_{agent_id}")
            
        for group in groups:
            self._broadcast_raw(group, broadcast_data)

    def _broadcast(self, instance, action):
        """
        Internal method to broadcast a message for an instance.

        Gets the broadcast data and sends it to:
        1. The specific agent's group (if model has an agent)
        2. The global control_room (for superusers)

        Args:
            instance: The model instance involved in the action
            action: String indicating the action ('created', 'updated', 'deleted')
        """
        data = self.get_broadcast_data(instance, action)
        
        # Determine target groups
        groups = ['control_room'] # Maintain global firehose for superusers
        
        # If model has 'agent' field, broadcast to that agent's channel
        if hasattr(instance, 'agent') and instance.agent:
            groups.append(f"agent_{instance.agent.id}")
            
        # Send to all relevant groups
        for group in groups:
            self._broadcast_raw(group, data)

    def _broadcast_raw(self, group_name, data):
        """
        Internal method to broadcast raw message data to a specific group.

        Args:
            group_name: Channel group to send to
            data: Dictionary with WebSocket message payload
        """
        try:
            channel_layer = get_channel_layer()

            async_to_sync(channel_layer.group_send)(
                group_name,
                data
            )
        except Exception as e:
            # Log error but don't fail the request
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to broadcast WebSocket message to {group_name}: {str(e)}")
