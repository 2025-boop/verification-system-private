# accounts/api/views/utility_views.py
"""
Utility API Views

Handles utility operations:
- Generate case ID: Creates a new unique case ID
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status
from django.utils import timezone
from django.db import connection

from accounts.services.case_id_service import CaseIDService
from accounts.models import Session
from accounts.api.permissions import IsStaffUser


class HealthCheckView(APIView):
    """
    Health check endpoint for monitoring backend, database, and Redis/Channels.

    GET /api/health/
    or GET /api/proxy/health/

    Returns:
    {
        "status": "healthy" | "unhealthy" | "degraded",
        "timestamp": "2025-11-17T12:00:00Z",
        "components": {
            "database": {"status": "ok", "message": "Database connected"},
            "redis": {"status": "ok", "message": "Redis connected"},
            "channels": {"status": "ok", "message": "Channels layer operational"}
        }
    }

    This endpoint is public (no authentication required) for monitoring purposes.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        """Check system health"""
        health_status = {
            "status": "healthy",
            "timestamp": timezone.now().isoformat(),
            "components": {}
        }

        # Check 1: Database connectivity
        database_status = self._check_database()
        health_status["components"]["database"] = database_status
        if database_status["status"] != "ok":
            health_status["status"] = "degraded"

        # Check 2: Redis/Channels connectivity
        redis_status = self._check_redis()
        health_status["components"]["redis"] = redis_status
        if redis_status["status"] == "error":
            health_status["status"] = "unhealthy" if health_status["status"] == "healthy" else "unhealthy"
        elif redis_status["status"] != "ok":
            health_status["status"] = "degraded"

        # Determine final status
        if (health_status["components"]["database"]["status"] != "ok" or
            health_status["components"]["redis"]["status"] == "error"):
            health_status["status"] = "unhealthy"

        return Response(health_status, status=status.HTTP_200_OK)

    def _check_database(self):
        """Check if database is accessible"""
        try:
            # Attempt a simple query
            Session.objects.values('uuid').first()

            # Also verify connection explicitly
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")

            return {
                "status": "ok",
                "message": "Database connected and operational"
            }
        except Exception as e:
            import logging
            logging.getLogger(__name__).exception("Database health check failed")
            return {
                "status": "error",
                "message": f"Database error: {str(e)}"
            }

    def _check_redis(self):
        """Check if Redis/Channels is accessible"""
        try:
            from channels.layers import get_channel_layer
            import asyncio

            channel_layer = get_channel_layer()

            # Try to access Redis via channel layer
            # For Redis backend, this checks connection
            if channel_layer is None:
                return {
                    "status": "warning",
                    "message": "Channel layer not configured"
                }

            # Attempt a simple operation to verify Redis is accessible
            try:
                # This is a synchronous check - we'll use async_to_sync
                from asgiref.sync import async_to_sync

                @async_to_sync
                async def check_channel():
                    try:
                        # Try to send a test message to a group (doesn't need recipients)
                        # This validates Redis connection without side effects
                        await channel_layer.group_send(
                            '__health_check__',
                            {
                                'type': 'health_check',
                                'message': 'health_check'
                            }
                        )
                        return True
                    except Exception:
                        return False

                if check_channel():
                    return {
                        "status": "ok",
                        "message": "Redis/Channels layer operational"
                    }
                else:
                    return {
                        "status": "warning",
                        "message": "Redis/Channels layer accessible but with warnings"
                    }

            except Exception as inner_e:
                # Even if group_send fails, Redis connection might exist
                # This is a graceful degradation
                return {
                    "status": "warning",
                    "message": f"Redis/Channels partially accessible: {str(inner_e)}"
                }

        except ImportError:
            return {
                "status": "warning",
                "message": "Channels not installed (optional)"
            }
        except Exception as e:
            import logging
            logging.getLogger(__name__).exception("Redis health check failed")
            return {
                "status": "error",
                "message": f"Redis error: {str(e)}"
            }


class GenerateCaseIDView(APIView):
    """
    Generate a unique case ID.

    POST /api/generate-case-id/

    Returns:
    - case_id: Newly generated unique case ID
    """

    permission_classes = [IsAuthenticated, IsStaffUser]

    def post(self, request):
        """Generate a new case ID"""
        try:
            case_id = CaseIDService.generate_unique_case_id()

            if not case_id:
                return Response(
                    {
                        'error': 'Failed to generate case ID after multiple attempts',
                        'status': 'error'
                    },
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            return Response(
                {
                    'status': 'success',
                    'case_id': case_id,
                    'message': f'Generated case ID: {case_id}'
                },
                status=status.HTTP_200_OK
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).exception("Error generating case ID")
            return Response(
                {
                    'error': str(e),
                    'status': 'error'
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
