"""
Celery Configuration for Control Room
======================================

This module configures Celery to work with Django settings.
Celery is used for asynchronous email delivery via the EmailService.

Environment-specific broker configuration is handled in settings files:
- local.py: redis://localhost:6379/0 (Docker Desktop Redis)
- docker.py: redis://redis:6379/0 (Docker Compose service)
- production.py: rediss://...:6379/0 (AWS ElastiCache with TLS)
"""

import os
from celery import Celery

# Set default Django settings module for Celery
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'control_room.settings')

# Create Celery app instance
app = Celery('control_room')

# Load configuration from Django settings
# - namespace='CELERY' means all Celery config settings should have CELERY_ prefix
# - This automatically reads CELERY_BROKER_URL, CELERY_RESULT_BACKEND, etc.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks in all installed Django apps
# Looks for tasks.py in each app (e.g., accounts/tasks.py)
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Debug task to verify Celery is working correctly"""
    print(f'Request: {self.request!r}')
