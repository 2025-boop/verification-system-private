"""
Celery Tasks for Email Delivery
================================

Async tasks for sending emails asynchronously without blocking HTTP requests.
Integrates with django-anymail and works with any email provider.

Tasks:
- send_email_task: Main task to send email, with auto-retry on failure
- process_email_webhook: Process webhooks from email provider
"""

from celery import shared_task
from django.core.exceptions import ObjectDoesNotExist
import logging

from accounts.models import EmailLog
from accounts.services.email_service import EmailService


logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def send_email_task(self, email_log_id: int):
    """
    Async task to send email via Celery worker.

    This task:
    - Loads the EmailLog from database
    - Executes EmailService.execute_send()
    - Automatically retries on failure (up to 3 times)
    - Uses exponential backoff: 60s, 120s, 240s

    Works with ANY email provider (SendGrid, Mailgun, SES, etc.)
    via django-anymail abstraction.

    Args:
        email_log_id: ID of EmailLog to send

    Returns:
        True if successful, False if failed after all retries
    """

    try:
        # Load EmailLog
        email_log = EmailLog.objects.get(id=email_log_id)

    except ObjectDoesNotExist:
        logger.error(f"EmailLog {email_log_id} not found - email cannot be sent")
        return False

    # Execute send via EmailService
    success = EmailService.execute_send(email_log)

    # If failed and retries remaining, retry with exponential backoff
    if not success and self.request.retries < self.max_retries:
        countdown = 60 * (2 ** self.request.retries)  # 60s, 120s, 240s
        logger.warning(
            f"Email {email_log_id} failed, retrying in {countdown}s "
            f"(attempt {self.request.retries + 1}/3)"
        )
        raise self.retry(countdown=countdown)

    return success


@shared_task
def process_email_webhook(event_data: dict):
    """
    Process webhooks from email provider (SendGrid, Mailgun, etc.).

    This task is called when:
    - Email is delivered
    - Email is opened
    - Link is clicked
    - Email bounces
    - etc.

    Updates EmailLog status based on provider webhook event.

    Supported events:
    - sent: Email delivered
    - open: Email opened
    - click: Link clicked
    - bounce: Email bounced
    - dropped: Email dropped
    - spamreport: Marked as spam
    - unsubscribe: User unsubscribed

    Args:
        event_data: Webhook payload from provider
                   Includes: message_id, event, timestamp, etc.
    """

    try:
        # Extract message ID and event type
        message_id = event_data.get('message_id')
        event = event_data.get('event')

        if not message_id or not event:
            logger.warning(f"Webhook missing message_id or event: {event_data}")
            return False

        # Load EmailLog by provider message ID
        try:
            email_log = EmailLog.objects.get(provider_message_id=message_id)
        except ObjectDoesNotExist:
            logger.warning(f"EmailLog not found for message_id: {message_id}")
            return False

        # Map provider events to EmailLog status
        event_status_map = {
            'sent': 'sent',
            'open': 'opened',
            'click': 'clicked',
            'bounce': 'bounced',
            'dropped': 'failed',
            'spamreport': 'bounced',
            'unsubscribe': 'bounced',
        }

        if event in event_status_map:
            new_status = event_status_map[event]

            # Only update if status changed
            if email_log.status != new_status:
                email_log.status = new_status
                email_log.save(update_fields=['status'])

                logger.info(
                    f"Email {email_log.id} status updated to '{new_status}' "
                    f"via webhook event '{event}'"
                )

        return True

    except Exception as e:
        logger.error(f"Error processing email webhook: {str(e)}")
        return False
