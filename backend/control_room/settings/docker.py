# ==================================================
# control_room/settings/docker.py
# ==================================================
"""
Docker-based local development settings.
Uses PostgreSQL and Redis from Docker service names.
Enables DEBUG mode for development.
This is specifically for development with docker-compose.
"""

from .base import *
from decouple import config

# Development mode ON
DEBUG = True

# Allow all hosts in development (Docker containers use service names)
ALLOWED_HOSTS = ["*"]

# PostgreSQL settings for Docker (service names: postgres, redis)
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("DB_NAME", default="controlroom_db"),
        "USER": config("DB_USER", default="postgres"),
        "PASSWORD": config("DB_PASSWORD", default="postgres"),
        "HOST": config("DB_HOST", default="postgres"),  # Docker service name
        "PORT": config("DB_PORT", default="5432"),
    }
}

# Redis from Docker service (default: redis:6379)
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [(
                config("REDIS_HOST", default="redis"),  # Docker service name
                config("REDIS_PORT", cast=int, default=6379)
            )],
        },
    },
}

# CORS for local development (frontend on various ports)
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:4000",
]

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:4000",
]

# ==============================================================================
# EMAIL CONFIGURATION (Universal Dynamic Backend)
# ==============================================================================
EMAIL_BACKEND = "accounts.backends.DynamicEmailBackend"

# Anymail Configuration
ANYMAIL = {
    "IGNORE_UNSUPPORTED_FEATURES": True,
}
