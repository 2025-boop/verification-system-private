import logging
from django.core.mail.backends.base import BaseEmailBackend
from django.utils.module_loading import import_string
from django.conf import settings as django_settings
from accounts.models import EmailSettings

logger = logging.getLogger(__name__)

class DynamicEmailBackend(BaseEmailBackend):
    """
    A wrapper backend that delegates to the active provider 
    configured in the EmailSettings database model.
    """
    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)
        self.settings_obj = EmailSettings.get_settings()
        self.provider_alias = self.settings_obj.email_provider
        self.connection = None

    def open(self):
        """
        Instantiate the specific backend connection.
        """
        if self.connection:
            return True

        if self.provider_alias == 'console':
            backend_path = 'django.core.mail.backends.console.EmailBackend'
            payload = {}
        
        elif self.provider_alias == 'smtp':
            backend_path = 'django.core.mail.backends.smtp.EmailBackend'
            payload = {
                'host': self.settings_obj.smtp_host,
                'port': self.settings_obj.smtp_port,
                'username': self.settings_obj.smtp_username,
                'password': self.settings_obj.smtp_password,
                'use_tls': self.settings_obj.smtp_use_tls,
                'use_ssl': self.settings_obj.smtp_use_ssl,
            }

        else:
            # Anymail Providers
            # Map alias to backend path
            ANYMAIL_BACKENDS = {
                'sendgrid': 'anymail.backends.sendgrid.EmailBackend',
                'mailgun': 'anymail.backends.mailgun.EmailBackend',
                'amazon_ses': 'anymail.backends.amazon_ses.EmailBackend',
                'mailjet': 'anymail.backends.mailjet.EmailBackend',
                'postmark': 'anymail.backends.postmark.EmailBackend',
                'brevo': 'anymail.backends.brevo.EmailBackend',
                'sparkpost': 'anymail.backends.sparkpost.EmailBackend',
            }
            backend_path = ANYMAIL_BACKENDS.get(self.provider_alias)
            
            if not backend_path:
                logger.error(f"Unknown provider '{self.provider_alias}', falling back to console.")
                backend_path = 'django.core.mail.backends.console.EmailBackend'
                payload = {}
            else:
                # Construct ANYMAIL settings dict
                # We need to construct the *kwargs* for the backend.
                # Anymail backends usually look at settings.ANYMAIL, but we can instruct them 
                # by passing api_key etc as kwargs if supported, OR by patching configurations.
                # However, Anymail backends typically take an 'api_key' arg in __init__ or look at settings.
                # The robust way with Anymail is to pass options in the constructor if it allows, 
                # but Anymail 10+ standardizes on settings.ANYMAIL.
                # BUT, Anymail's EmailBackend accepts **kwargs and merges them into its config.
                
                payload = self._get_provider_payload(self.provider_alias)
                
                # Global Webhook Secret check
                if self.settings_obj.webhook_secret:
                    payload['WEBHOOK_SECRET'] = self.settings_obj.webhook_secret
                    
        try:
            backend_cls = import_string(backend_path)
            self.connection = backend_cls(fail_silently=self.fail_silently, **payload)
            return self.connection.open()
        except Exception as e:
            logger.error(f"Failed to initialize email backend {backend_path}: {e}")
            if not self.fail_silently:
                raise
            return False

    def close(self):
        if self.connection:
            self.connection.close()

    def send_messages(self, email_messages):
        if not email_messages:
            return 0
        
        # Ensure connection is open
        if not self.connection:
            if not self.open():
                return 0
                
        # Apply Default From Email if missing
        default_from = f"{self.settings_obj.from_name} <{self.settings_obj.default_from_email}>"
        
        for msg in email_messages:
            if not msg.from_email:
                msg.from_email = default_from
        
        return self.connection.send_messages(email_messages)

    def _get_provider_payload(self, provider):
        """Construct the kwargs for Anymail backend __init__"""
        s = self.settings_obj
        p = {}

        if provider == 'sendgrid':
            p['api_key'] = s.sendgrid_api_key
            if s.sendgrid_webhook_verification_key:
                p['WEBHOOK_VERIFICATION_KEY'] = s.sendgrid_webhook_verification_key

        elif provider == 'mailgun':
            p['api_key'] = s.mailgun_api_key
            if s.mailgun_sender_domain:
                p['sender_domain'] = s.mailgun_sender_domain
            if s.mailgun_webhook_signing_key:
                p['WEBHOOK_SIGNING_KEY'] = s.mailgun_webhook_signing_key
        
        elif provider == 'amazon_ses':
            # AWS usually takes specific params or boto3 session
            # Anymail 'amazon_ses' uses boto3. 
            # We can pass session_params or access_key/secret_key if the backend supports it.
            # Checking Anymail source: BaseAnymailBackend accepts **kwargs and puts them in self.esp_config.
            # AmazonSESBackend uses self.esp_config to build session.
            p['access_key_id'] = s.aws_access_key_id
            p['secret_access_key'] = s.aws_secret_access_key
            p['region_name'] = s.aws_region
            
        elif provider == 'mailjet':
            p['api_key'] = s.mailjet_api_key
            p['secret_key'] = s.mailjet_secret_key
            
        elif provider == 'postmark':
            p['server_token'] = s.postmark_server_token
            # Account token is usually for API ops, not sending, but we'll map it if needed
            if s.postmark_account_token:
                p['account_token'] = s.postmark_account_token
                
        elif provider == 'brevo':
            p['api_key'] = s.brevo_api_key
            
        elif provider == 'sparkpost':
            p['api_key'] = s.sparkpost_api_key
            
        return p
