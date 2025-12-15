# accounts/routing.py
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/control-room/$', consumers.ControlRoomConsumer.as_asgi()),
    re_path(r'ws/session/(?P<uuid>[0-9a-f-]+)/$', consumers.SessionConsumer.as_asgi()),
]
