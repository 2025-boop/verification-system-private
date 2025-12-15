"""
Control Room - User Verification Platform

A Django backend that enables agents to have real-time control over user
verification sessions with WebSocket-powered real-time updates.
"""

# Configure Django to use the AccountsConfig app configuration
# This ensures the ready() method is called to register signal handlers
default_app_config = 'accounts.apps.AccountsConfig'
