import os
import sys
import django
import argparse

# Setup Django
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'control_room.settings.local')
django.setup()

from accounts.models import EmailSettings
from django.core.mail import send_mail
from django.utils import timezone

def live_test(provider, api_key, to_email, sender_domain=None):
    print(f"--- Live Email Test: {provider.upper()} ---")
    
    # 1. Update Database
    print(f"1. Configuring EmailSettings for {provider}...")
    s = EmailSettings.get_settings()
    s.email_provider = provider
    
    if provider == 'brevo':
        s.brevo_api_key = api_key
    elif provider == 'sendgrid':
        s.sendgrid_api_key = api_key
    elif provider == 'mailgun':
        s.mailgun_api_key = api_key
        if sender_domain:
            s.mailgun_sender_domain = sender_domain
    
    # Ensure from_email is valid for the provider
    # Brevo requires a verified sender.
    if provider == 'brevo':
        # Prompt user if they didn't set a default, but for now assuming 'noreply@example.com' or what's in DB
        pass
        
    s.save()
    print("   Configuration saved.")
    
    # 2. Send Email
    print(f"2. Sending test email to {to_email}...")
    try:
        subject = f"Test Email via {provider} - {timezone.now()}"
        message = f"This is a test email sent from the Universal Dynamic Backend using {provider}."
        
        count = send_mail(
            subject,
            message,
            from_email=None, # Uses default from settings/DB
            recipient_list=[to_email],
            fail_silently=False
        )
        
        if count == 1:
            print("   SUCCESS: Email handed off to provider!")
        else:
            print("   WARNING: send_mail returned 0.")
            
    except Exception as e:
        print(f"   FAIL: {e}")
        print("\n   Troubleshooting Tips:")
        if 'Sender' in str(e):
            print("   - check if your 'From Email' (in Admin) is a verified sender in Brevo.")
        if 'ApiKey' in str(e):
            print("   - Check your API Key.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Send a live test email')
    parser.add_argument('--provider', type=str, required=True, help='brevo, sendgrid, etc.')
    parser.add_argument('--key', type=str, required=True, help='API Key')
    parser.add_argument('--to', type=str, required=True, help='Recipient Email')
    parser.add_argument('--domain', type=str, help='Sender Domain (Mailgun only)')
    
    args = parser.parse_args()
    
    live_test(args.provider, args.key, args.to, args.domain)
