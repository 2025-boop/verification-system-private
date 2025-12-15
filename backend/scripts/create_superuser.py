#!/usr/bin/env python
"""
Create default superuser for Control Room.
Uses environment variables for credentials if available.
"""

import os
import sys
import django
import time
from pathlib import Path

# Add parent directory to Python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'control_room.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.db import OperationalError

User = get_user_model()


def create_default_superuser():
    """
    Create default superuser from environment variables.
    """
    username = os.getenv("DJANGO_SUPERUSER_USERNAME", "admin")
    email = os.getenv("DJANGO_SUPERUSER_EMAIL", "admin@example.com")
    password = os.getenv("DJANGO_SUPERUSER_PASSWORD", "CanadaIsGreat@123")

    max_retries = 5
    retry_delay = 2

    for attempt in range(1, max_retries + 1):
        try:
            if not User.objects.filter(username=username).exists():
                print(f"🔑 Creating superuser: {username}")
                User.objects.create_superuser(
                    username=username,
                    email=email,
                    password=password,
                )
                print("✅ Superuser created successfully")
            else:
                print(f"ℹ️  Superuser '{username}' already exists")
            return True

        except OperationalError as e:
            if attempt < max_retries:
                print(f"⏳ DB not ready (attempt {attempt}), retrying...")
                time.sleep(retry_delay)
            else:
                print(f"❌ Failed to create superuser: {e}")
                return False
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            return False

    return False


if __name__ == "__main__":
    success = create_default_superuser()
    sys.exit(0 if success else 1)

