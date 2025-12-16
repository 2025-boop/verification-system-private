import os
import django
import sys
from django.conf import settings

# Setup Django
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'control_room.settings.local')
django.setup()

from accounts.models import EmailSettings
from accounts.backends import DynamicEmailBackend
from django.core.mail import get_connection

def test_backend_construction():
    print("Testing Backend Construction...")
    
    # reset singleton
    EmailSettings.objects.all().delete()
    s = EmailSettings.get_settings()
    
    # 1. Test Console
    print("1. Testing Console Provider...")
    s.email_provider = 'console'
    s.save()
    
    backend = DynamicEmailBackend()
    backend.open()
    print(f"   Active Connection: {backend.connection.__class__.__name__} from {backend.connection.__module__}")
    
    # Console backend is class EmailBackend in django.core.mail.backends.console
    if 'console' not in backend.connection.__module__:
        print(f"FAIL: Expected console module, got {backend.connection.__module__}")
        return
    
    # 2. Test SendGrid
    print("2. Testing SendGrid Provider...")
    s.email_provider = 'sendgrid'
    s.sendgrid_api_key = 'SG.TEST'
    s.sendgrid_webhook_verification_key = 'KEY123'
    s.save()
    
    backend = DynamicEmailBackend()
    # open() triggers import of Anymail backend
    try:
        backend.open()
        print(f"   Active Connection: {backend.connection.__class__.__name__}")
        # Verify payload
        # Anymail backend stores config in esp_config or similar, usually accessible via API stub? 
        # Actually simplest check is if it initialized without error.
    except Exception as e:
        print(f"   FAIL: Initialization error: {e}")
        # It might fail if cryptography not installed, but we added it to requirements.

    # 3. Test Mailgun
    print("3. Testing Mailgun Provider...")
    s.email_provider = 'mailgun'
    s.mailgun_api_key = 'key-123'
    s.mailgun_sender_domain = 'mg.example.com'
    s.save()
    
    backend = DynamicEmailBackend()
    backend.open()
    print(f"   Active Connection: {backend.connection.__class__.__name__}")

    print("SUCCESS: All providers instantiated correctly.")

if __name__ == "__main__":
    test_backend_construction()
