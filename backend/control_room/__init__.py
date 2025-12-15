"""
Control Room Django Application
================================

This module imports the Celery app to ensure it's loaded when Django starts.
This is required for Celery's autodiscovery of tasks.
"""

# Import Celery app so it's available when Django starts
from .celery import app as celery_app

__all__ = ('celery_app',)
