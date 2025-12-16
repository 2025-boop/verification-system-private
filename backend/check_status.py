
import os
import django
import sys

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'control_room.settings.production')
django.setup()

from accounts.models import EmailLog

print("--- EMAIL LOG STATUS ---")
try:
    last = EmailLog.objects.last()
    if last:
        print(f"ID: {last.id}")
        print(f"TO: {last.to_email}")
        print(f"STATUS: {last.status}")
        print(f"ERROR: {last.error_message}")
    else:
        print("NO_LOGS_FOUND")
except Exception as e:
    print(f"ERROR: {e}")
print("------------------------")
