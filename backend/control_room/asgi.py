import os
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'control_room.settings')

# Get the Django ASGI application
django_asgi_app = get_asgi_application()

# Now import Channels components AFTER Django is set up
from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
import accounts.routing
from control_room.middleware import JWTAuthMiddleware

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": JWTAuthMiddleware(
        AuthMiddlewareStack(
            URLRouter(
                accounts.routing.websocket_urlpatterns
            )
        )
    ),
})


