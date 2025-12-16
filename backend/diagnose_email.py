
import os
import django
import sys

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'control_room.settings.production')
django.setup()

from django.conf import settings
from accounts.models import EmailSettings

print("--- DIAGNOSTIC RESULT ---")
print(f"CONF_BACKEND: {settings.EMAIL_BACKEND}")
print(f"ANYMAIL_CFG: {getattr(settings, 'ANYMAIL', 'Not Set')}")

try:
    obj = EmailSettings.objects.first()
    if obj:
        print(f"DB_PROVIDER: {obj.email_provider}")
        print(f"DB_SMTP_HOST: '{obj.smtp_host}'")
        print(f"DB_FROM: {obj.default_from_email}")
        print(f"DB_SENDGRID_KEY_SET: {bool(obj.sendgrid_api_key)}")
        print(f"DB_BREVO_KEY_SET: {bool(obj.brevo_api_key)}")
    else:
        print("DB_PROVIDER: NONE (Table Empty)")
except Exception as e:
    print(f"DB_ERROR: {e}")

print("-------------------------")
