# ==================================================
# control_room/settings/local.py
# ==================================================
"""
Local development settings.
Uses SQLite, enables DEBUG, and allows localhost origins.
This file should NOT be used in production.
"""

from .base import *

DEBUG = True
ALLOWED_HOSTS = ["*"]

# SQLite for local development
database_file = BASE_DIR / "db.sqlite3"
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": database_file,
    }
}

# Local Redis (must be running with Docker or locally)
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [("localhost", 6379)],
        },
    },
}

# Allowed local frontend origins
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:4000",
    "https://control-room-frontend-agent-portal.onrender.com",  # Production frontend (for testing)
]

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:4000",
    "https://control-room-frontend-agent-portal.onrender.com",  # Production frontend (for testing)
]

# ==================================================
# Email Configuration (Local Development)
# ==================================================
# Console backend: emails print to terminal (no actual sending)
# Perfect for testing without configuring email provider
# EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

EMAIL_BACKEND = "anymail.backends.mailjet.EmailBackend"

ANYMAIL = {

    "MAILJET_API_KEY": "8b5e96e687eac1df269e7443e077cf7c",
    "MAILJET_SECRET_KEY": "cee92c55d399613e7fff66df9df7abca",
}
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='juanitahodkiewicz@hotmail.com')

# Alternatively, use Gmail SMTP for actual testing:
# EMAIL_BACKEND = 'anymail.backends.smtp.EmailBackend'
# EMAIL_HOST = 'smtp.gmail.com'
# EMAIL_PORT = 587
# EMAIL_USE_TLS = True
# EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='your-email@gmail.com')
# EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='your-app-password')
# DEFAULT_FROM_EMAIL = EMAIL_HOST_USER

# ==================================================
# Celery Configuration (Local Development)
# ==================================================
# Execute tasks synchronously (immediately) - no async worker needed
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

# Celery broker - hardcoded to localhost (matches CHANNEL_LAYERS pattern)
# This ensures local dev always uses Docker Desktop Redis at localhost:6379
# Overrides base.py to prevent reading CELERY_BROKER_URL from .env
CELERY_BROKER_URL = 'redis://localhost:6379/0'
CELERY_RESULT_BACKEND = 'redis://localhost:6379/1'

