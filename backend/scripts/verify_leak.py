
import os
import django
import asyncio
import json
from channels.testing import WebsocketCommunicator
from channels.layers import get_channel_layer
from asgiref.sync import sync_to_async

# Setup Django
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'control_room.settings')
django.setup()

# OVERRIDE CHANNEL LAYERS TO USE IN-MEMORY
from django.conf import settings
settings.CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer"
    }
}

from django.contrib.auth import get_user_model
from accounts.models import Session
from control_room.asgi import application
from rest_framework_simplejwt.tokens import AccessToken

User = get_user_model()

async def verify_security():
    print("🛡️ Starting Security Verification...")

    # 1. Setup Users
    # Staff User (Regular Staff, NOT Superuser)
    staff_user, _ = await sync_to_async(User.objects.get_or_create)(username='staff_test', defaults={'email': 'staff@test.com'})
    staff_user.is_staff = True
    staff_user.is_superuser = False
    await sync_to_async(staff_user.save)()

    # Regular Agents
    agent_a, _ = await sync_to_async(User.objects.get_or_create)(username='agent_a', defaults={'email': 'a@test.com', 'is_staff': False})
    agent_b, _ = await sync_to_async(User.objects.get_or_create)(username='agent_b', defaults={'email': 'b@test.com', 'is_staff': False})
    
    # Attacker (No Auth)
    attacker_user, _ = await sync_to_async(User.objects.get_or_create)(username='attacker_test', defaults={'email': 'attacker@test.com', 'is_staff': False})

    # 2. Setup Session for Agent A
    session = await sync_to_async(Session.objects.create)(
        agent=agent_a,
        external_case_id="SECURE-TEST-001",
        stage="case_id",
        user_data={"sensitive": "TOP_SECRET_DATA"}
    )
    print(f"✅ Session Created: {session.uuid} for Agent A")

    # ---------------------------------------------------------
    # TEST 1: Control Room Isolation (Staff User)
    # Expected: Staff connecting to control-room is rejected (code 4003) or joins but receives NO updates
    # Logic Update: Staff is not Superuser, so they are pushed to their OWN agent channel. They shouldn't see Agent A's stuff.
    # ---------------------------------------------------------
    print("\n🧪 TEST 1: Verifying Agent Isolation (Staff/Other Agent)...")
    
    communicator_staff = WebsocketCommunicator(application, "/ws/control-room/")
    communicator_staff.scope["user"] = staff_user
    connected, _ = await communicator_staff.connect()
    
    if connected:
        print("   Staff connected (joined own channel)")
        
        # Broadcast update for Session A
        # Should go to agent_a and control_room (super). Staff is on agent_{staff_id}.
        from accounts.api.mixins import WebSocketBroadcastMixin
        mixin = WebSocketBroadcastMixin()
        session._broadcasted_by_viewset = False # ensure we can re-broadcast
        await sync_to_async(mixin._broadcast)(session, 'updated')
        
        try:
            msg = await communicator_staff.receive_json_from(timeout=1)
            # If msg is just connection open, ignore
            if msg.get('type') == 'connection_established':
                 msg = await communicator_staff.receive_json_from(timeout=1)

            if msg.get('type') == 'broadcast_message' and msg['data']['uuid'] == str(session.uuid):
                print(f"🚨 FAILURE: Staff received update for Agent A's session!")
            else:
                 print(f"✅ SUCCESS: Staff did NOT receive update (Got: {msg})")
        except:
             print("✅ SUCCESS: Staff received NO update")
             
        await communicator_staff.disconnect()
    else:
        print("ℹ️ Staff rejected (Acceptable result)")

    # ---------------------------------------------------------
    # TEST 2: Attacker Snoop (No Token)
    # Expected: 403 Forbidden / Disconnection
    # ---------------------------------------------------------
    print("\n🧪 TEST 2: Verifying Attacker Rejection (No Token)...")
    communicator_snoop = WebsocketCommunicator(application, f"/ws/session/{session.uuid}/")
    communicator_snoop.scope["user"] = attacker_user # Authenticated but NOT owner
    # OR unauthenticated
    # communicator_snoop.scope["user"] = AnonymousUser() 
    
    connected, _ = await communicator_snoop.connect()
    
    if connected:
        print("🚨 FAILURE: Attacker connected to Session Channel without Guest Token!")
        await communicator_snoop.disconnect()
    else:
        print("✅ SUCCESS: Attacker Rejected from Session Channel")


    # ---------------------------------------------------------
    # TEST 3: Guest Access (With Token)
    # Expected: Connection Success
    # ---------------------------------------------------------
    print("\n🧪 TEST 3: Verifying Valid Guest Access (With Token)...")
    
    # Generate Token
    token = AccessToken()
    token['session_uuid'] = str(session.uuid)
    token['scope'] = 'guest'
    
    # Simulate Cookie Header
    headers = [
        (b"cookie", f"access_token={str(token)}".encode("ascii"))
    ]
    
    communicator_guest = WebsocketCommunicator(application, f"/ws/session/{session.uuid}/", headers=headers)
    connected, _ = await communicator_guest.connect()
    
    if connected:
        print("✅ SUCCESS: Guest with Valid Token Connected")
        await communicator_guest.disconnect()
    else:
        print("🚨 FAILURE: Guest with Valid Token was Rejected!")


    # Cleanup
    await sync_to_async(session.delete)()
    print("\n🏁 Security Verification Complete.")

if __name__ == "__main__":
    asyncio.run(verify_security())
