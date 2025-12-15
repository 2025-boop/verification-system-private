from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'accounts'

    def ready(self):
        """
        Register signal handlers when the Django app is ready.

        This method is called after Django initializes all apps.
        We import signals here to ensure they're registered with the dispatcher.

        Signals registered:
        - accounts.signals.broadcast_session_save (post_save for Session)
        - accounts.signals.broadcast_session_delete (post_delete for Session)

        These signals ensure WebSocket broadcasts happen for ALL session
        operations, regardless of how the model was saved (API, admin, shell, etc.).
        """
        import accounts.signals  # noqa: F401
