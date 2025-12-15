# control_room/settings/base.py
"""
Base Django settings shared between all environments.
This file contains configuration that is common to both development and production.
Environment‑specific overrides must be placed in local.py or production.py.
"""

from pathlib import Path
from datetime import timedelta
from decouple import config

# --------------------------------------------------
# Core Paths
# --------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# --------------------------------------------------
# Security
# --------------------------------------------------
# SECRET_KEY is loaded from environment variables.
# A fallback is provided for local development only.
SECRET_KEY = config("SECRET_KEY", default="dev-secret-key")
DEBUG = False  # Default off for safety
ALLOWED_HOSTS = []  # Overridden per environment

# --------------------------------------------------
# Installed Applications
# --------------------------------------------------
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Project Apps
    'channels',
    'accounts',

    # Third‑Party Apps
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
]

# --------------------------------------------------
# Middleware
# --------------------------------------------------
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # Allows API access from frontend origins

    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Serves static files in prod

    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# --------------------------------------------------
# Templates
# --------------------------------------------------
ROOT_URLCONF = 'control_room.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],  # Additional template directories go here
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# --------------------------------------------------
# ASGI/WSGI
# --------------------------------------------------
WSGI_APPLICATION = 'control_room.wsgi.application'
ASGI_APPLICATION = 'control_room.asgi.application'

# --------------------------------------------------
# Database (overridden in environment-specific files)
# --------------------------------------------------
DATABASES = {}

# --------------------------------------------------
# Password Validation
# --------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# --------------------------------------------------
# Internationalization
# --------------------------------------------------
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# --------------------------------------------------
# Static Files
# --------------------------------------------------
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [BASE_DIR / 'static']
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# --------------------------------------------------
# REST Framework
# --------------------------------------------------
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

# --------------------------------------------------
# JWT Authentication
# --------------------------------------------------
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}

# --------------------------------------------------
# Authentication Redirects
# --------------------------------------------------
LOGIN_URL = '/accounts/login/'
LOGIN_REDIRECT_URL = '/dashboard/'
LOGOUT_REDIRECT_URL = '/accounts/login/'

# --------------------------------------------------
# Session Settings
# --------------------------------------------------
SESSION_COOKIE_AGE = 3600  # 1 hour
SESSION_SAVE_EVERY_REQUEST = True

# --------------------------------------------------
# Primary Key Settings
# --------------------------------------------------
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
