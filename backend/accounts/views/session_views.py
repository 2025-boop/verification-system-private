# accounts/views/session_views.py
"""
Session Detail Template Views

Handles server-rendered HTML views for individual sessions:
- Session detail: Main session control page with real-time updates
"""

from django.shortcuts import render, get_object_or_404
from django.contrib.auth.decorators import login_required
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

    Template: accounts/session_detail.html
    """
    session = get_object_or_404(Session, uuid=uuid, agent=request.user)

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
