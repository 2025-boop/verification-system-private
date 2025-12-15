# accounts/views/crud_views.py
"""
CRUD Operation Template Views

Handles create, read, update, delete operations:
- Confirm delete: Show confirmation modal
- Delete sessions: Delete selected sessions
"""

from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from accounts.models import Session


@login_required
def confirm_delete_selected(request):
    """
    Show delete confirmation modal partial.

    Called with: ?sessions=uuid1&sessions=uuid2&...

    Displays list of sessions to be deleted for user confirmation.

    Template: accounts/partials/_delete_sessions_modal.html
    """
    sessions = request.GET.getlist("sessions")

    return render(
        request,
        "accounts/partials/_delete_sessions_modal.html",
        {"sessions": sessions},
    )


@login_required
@require_POST
def delete_selected_sessions(request):
    """
    Delete selected sessions.

    POST with: sessions=uuid1&sessions=uuid2&...

    Deletes the selected sessions from the database.
    Returns JSON response with success status.

    Response:
    {
        "status": "deleted",
        "count": 2
    }
    """
    session_ids = request.POST.getlist("sessions")

    if not session_ids:
        return JsonResponse(
            {"error": "No sessions provided"},
            status=400
        )

    deleted_count = 0

    for uuid in session_ids:
        try:
            session = Session.objects.get(uuid=uuid)

            # Verify permission: agent can only delete their own sessions
            if session.agent != request.user and not request.user.is_staff:
                continue

            session.delete()
            deleted_count += 1

        except Session.DoesNotExist:
            # Skip non-existent sessions
            continue
        except Exception as e:
            # Log error but continue with other deletions
            import logging
            logging.getLogger(__name__).exception(f"Error deleting session {uuid}: {str(e)}")
            continue

    return JsonResponse({
        "status": "deleted",
        "count": deleted_count
    })
