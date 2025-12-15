"""
JWT Authentication Middleware for WebSocket (Django Channels)

This middleware extracts JWT tokens from HTTP-only cookies and validates them,
allowing WebSocket connections to be authenticated via JWT tokens.

Flow:
1. WebSocket handshake includes cookies (HTTP-only tokens)
2. This middleware extracts the JWT token from 'access_token' cookie
3. Validates the token using rest_framework_simplejwt
4. Sets scope['user'] so AuthMiddlewareStack has an authenticated user
5. Consumer checks user.is_authenticated and user.is_staff
"""

import asyncio
from urllib.parse import parse_qs
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

User = get_user_model()


class JWTAuthMiddleware(BaseMiddleware):
    """
    Middleware that authenticates WebSocket connections using JWT tokens.

    Looks for JWT in:
    1. 'access_token' cookie (HTTP-only cookie from frontend login)
    2. 'token' query parameter (fallback for testing)

    Cookie naming convention:
    - access_token: Short-lived JWT (5 minutes), used for API calls and WebSocket
    - refresh_token: Long-lived JWT (7 days), used to refresh access_token
    """

    async def __call__(self, scope, receive, send):
        # Only process WebSocket connections
        if scope["type"] != "websocket":
            await super().__call__(scope, receive, send)
            return

        # Extract token from cookie or query parameter
        token = self.get_token_from_scope(scope)

        # Try to validate the token
        if token:
            try:
                # Validate token
                validated_token = AccessToken(token)
                user_id = validated_token.get('user_id')

                if user_id:
                    # Get the user from database
                    user = await self.get_user(user_id)
                    scope['user'] = user
                # NEW: Guest Token Logic
                elif validated_token.get('scope') == 'guest':
                    print(f"[JWT Auth] Guest token detected for Session {validated_token.get('session_uuid')}")
                    scope['user'] = AnonymousUser()
                    scope['guest_claims'] = {
                        'session_uuid': validated_token.get('session_uuid'),
                        'scope': 'guest'
                    }
                else:
                    scope['user'] = AnonymousUser()
            except (InvalidToken, TokenError) as e:
                print(f"[JWT Auth] Invalid token: {e}")
                scope['user'] = AnonymousUser()
        else:
            scope['user'] = AnonymousUser()

        await super().__call__(scope, receive, send)

    @staticmethod
    def get_token_from_scope(scope):
        """Extract JWT token from WebSocket scope (cookies or query params)"""

        # Try to get token from cookies (HTTP-only cookie sent with WebSocket upgrade)
        headers = dict(scope.get('headers', []))
        cookie_header = headers.get(b'cookie', b'').decode('utf-8')

        if cookie_header:
            # Parse cookies
            cookies = {}
            for cookie in cookie_header.split(';'):
                parts = cookie.strip().split('=')
                if len(parts) == 2:
                    cookies[parts[0]] = parts[1]

            if 'access_token' in cookies:
                print(f"[JWT Auth] Found 'access_token' cookie")
                return cookies['access_token']

        # Fallback: Try query parameter (for testing/debugging)
        query_string = scope.get('query_string', b'').decode('utf-8')
        if query_string:
            params = parse_qs(query_string)
            if 'token' in params:
                print(f"[JWT Auth] Found 'token' in query parameters")
                return params['token'][0]

        print("[JWT Auth] No token found in cookies or query parameters")
        return None

    @staticmethod
    async def get_user(user_id):
        """
        Asynchronously fetch user from database.
        Uses asyncio to_thread to call the synchronous ORM method.
        """
        try:
            # Use asyncio.to_thread to run sync ORM call in thread pool
            user = await asyncio.to_thread(User.objects.get, id=user_id)
            print(f"[JWT Auth] Authenticated user: {user.username} (staff: {user.is_staff})")
            return user
        except User.DoesNotExist:
            print(f"[JWT Auth] User ID {user_id} not found")
            return AnonymousUser()
        except Exception as e:
            print(f"[JWT Auth] Error fetching user: {e}")
            return AnonymousUser()
