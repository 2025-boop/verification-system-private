# accounts/views/session_views.py
"""
Session Detail Template Views

Handles server-rendered HTML views for individual sessions:
- Session detail: Main session control page with real-time updates
"""

from django.shortcuts import render, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden
from accounts.models import Session


@login_required
def session_detail(request, uuid):
    """
    Detailed session view for agents.

    Shows:
    - Current stage and status
    - User's current submission (if any)
    - Verified/approved data
    - Control buttons (accept, reject, force complete, etc.)
    - Session logs/history
    - Agent notes

    WebSocket updates this page in real-time:
    - User submissions
    - Stage changes
    - Status changes

    Permission:
    - Superusers can view any session
    - Agents can only view their own sessions

    Template: accounts/session_detail.html
    """
    session = get_object_or_404(Session, uuid=uuid)
    
    # Permission check: superusers can access any, agents only their own
    if not request.user.is_superuser and session.agent != request.user:
        return HttpResponseForbidden("You can only access your own sessions")

    # Get last 50 log entries for this session
    logs = session.logs.all().order_by('-created_at')[:50]

    # Prepare session data for template
    user_data = session.user_data or {}
    session_data = {
        'verified_data': user_data.get('verified_data', {}),
        'current_submission': user_data.get('current_submission', {})
    }

    return render(request, 'accounts/session_detail.html', {
        'session_uuid': session.uuid,
        'session': session,
        'logs': logs,
        'session_data': session_data
    })
