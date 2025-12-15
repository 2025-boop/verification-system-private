# accounts/views/dashboard_views.py
"""
Agent Dashboard Template Views

Handles server-rendered HTML views for agent dashboards:
- Dashboard: Main dashboard with active and recent sessions
- Sessions list: All active sessions
- History: Completed/terminated sessions
"""

import random
from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from accounts.models import Session


@login_required
def dashboard(request):
    """
    Main dashboard for authenticated agents.

    Shows:
    - Active sessions (currently running)
    - Recent sessions (completed / terminated)

    Template: accounts/dashboard.html
    """
    # Get agent's active sessions
    active_sessions = Session.objects.filter(
        agent=request.user,
        status='active'
    ).order_by('-updated_at')

    # Get agent's recent sessions (last 10)
    recent_sessions = Session.objects.filter(
        agent=request.user,
        status__in=['completed', 'terminated', 'failed', 'cancelled', 'expired']
    ).order_by('-updated_at')[:10]

    # Generate random ID for quick session creation
    random_id = ''.join(random.choices('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', k=6))

    return render(request, 'accounts/dashboard.html', {
        'user': request.user,
        'active_sessions': active_sessions,
        'recent_sessions': recent_sessions,
        'random_id': random_id,
    })


@login_required
def sessions_list(request):
    """
    List all active sessions.

    Template: accounts/sessions.html
    """
    active_sessions = Session.objects.filter(status='active').order_by('-updated_at')

    return render(request, 'accounts/sessions.html', {
        'active_sessions': active_sessions
    })


@login_required
def history(request):
    """
    List completed or terminated sessions (historical data).

    Template: accounts/history.html
    """
    completed_sessions = Session.objects.filter(
        status__in=['completed', 'terminated']
    ).order_by('-updated_at')

    return render(request, 'accounts/history.html', {
        'completed_sessions': completed_sessions
    })
