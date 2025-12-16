# ==================================================
# control_room/settings/production.py
# ==================================================
"""
Production settings for deployment.
Uses PostgreSQL, production Redis, strict hosts, and environment-based secrets.
"""

from .base import *
from decouple import config

DEBUG = False

# Comma-separated list in .env.production
ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="").replace(" ", "").split(",")
# Automatically allow internal docker service names and localhost
ALLOWED_HOSTS += ["backend", "localhost", "127.0.0.1"]

# PostgreSQL settings loaded from environment variables
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("DB_NAME"),
        "USER": config("DB_USER"),
        "PASSWORD": config("DB_PASSWORD"),
        "HOST": config("DB_HOST"),
        "PORT": config("DB_PORT", default="5432"),
        "CONN_MAX_AGE": 600,  # Keep connections alive for 10 minutes (fixes transaction isolation issue)
        "OPTIONS": {
            "connect_timeout": 10,
        },
    }
}

# Redis (usually running in Docker or AWS ElastiCache)
# Redis Configuration with SSL Support
REDIS_HOST = config("REDIS_HOST", default="localhost")
REDIS_PORT = config("REDIS_PORT", default=6379, cast=int)
REDIS_PASSWORD = config("REDIS_PASSWORD", default="")
REDIS_SSL = config("REDIS_SSL", default=False, cast=bool)

def get_channel_layer_hosts():
    if REDIS_SSL:
        # Construct rediss:// URL for robust SSL handling
        url = f"rediss://{REDIS_HOST}:{REDIS_PORT}"
        if REDIS_PASSWORD:
            url = f"rediss://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}"
            
        # SSL Cert Requirements
        cert_reqs = config("REDIS_SSL_CERT_REQS", default="required").lower()
        if cert_reqs == "none":
            url += "?ssl_cert_reqs=none"
        elif cert_reqs == "optional":
            url += "?ssl_cert_reqs=optional"
        else:
            url += "?ssl_cert_reqs=required"
            
        return [url]
    else:
        # Standard TCP connection
        host_config = {"host": REDIS_HOST, "port": REDIS_PORT}
        if REDIS_PASSWORD:
            host_config["password"] = REDIS_PASSWORD
        return [host_config]

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": get_channel_layer_hosts(),
            "capacity": 1500,
            "expiry": 10,
        },
    },
}

# CORS for frontend deployment
# Robust empty string handling
cors_origins = config("CORS_ALLOWED_ORIGINS", default="").split(",")
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in cors_origins if origin.strip()]

csrf_origins = config("CSRF_TRUSTED_ORIGINS", default="").split(",")
CSRF_TRUSTED_ORIGINS = [origin.strip() for origin in csrf_origins if origin.strip()]


# ==============================================================================
# EMAIL CONFIGURATION (Universal Dynamic Backend)
# ==============================================================================
EMAIL_BACKEND = "accounts.backends.DynamicEmailBackend"

# Anymail Configuration
ANYMAIL = {
    "IGNORE_UNSUPPORTED_FEATURES": True,
}

# ==============================================================================
# CELERY CONFIGURATION
# ==============================================================================
# Reuse Redis logic from Channel Layers for Celery Broker
if REDIS_SSL:
    CELERY_BROKER_URL = f"rediss://{REDIS_HOST}:{REDIS_PORT}/0"
    if REDIS_PASSWORD:
        CELERY_BROKER_URL = f"rediss://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/0"
    
    # Celery SSL options
    cert_reqs = config("REDIS_SSL_CERT_REQS", default="required").lower()
    import ssl
    ssl_reqs = ssl.CERT_REQUIRED
    if cert_reqs == "none":
        ssl_reqs = ssl.CERT_NONE
    elif cert_reqs == "optional":
        ssl_reqs = ssl.CERT_OPTIONAL
        
    CELERY_BROKER_USE_SSL = {
        'ssl_cert_reqs': ssl_reqs
    }
    CELERY_REDIS_BACKEND_USE_SSL = CELERY_BROKER_USE_SSL
else:
    CELERY_BROKER_URL = f"redis://{REDIS_HOST}:{REDIS_PORT}/0"
    if REDIS_PASSWORD:
        CELERY_BROKER_URL = f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/0"

CELERY_RESULT_BACKEND = CELERY_BROKER_URL  # Store results in Redis too

# Use Synchronous Sending for now (Simpler than managing a worker container)
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
