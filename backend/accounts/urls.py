#accounts/urls
"""
Django URL Configuration for Control Room Backend

Routes for:
1. Django template views (agent dashboard)

Note: New REST API endpoints are at /api/ and use accounts.api.urls
"""

from django.urls import path
from django.contrib.auth import views as auth_views

# Import template views from modularized structure
from .views.dashboard_views import dashboard, sessions_list, history
from .views.session_views import session_detail
from .views.partial_views import (
    get_stage_controls,
    get_session_stepper,
    get_verified_data,
    get_current_submission,
)
from .views.crud_views import confirm_delete_selected, delete_selected_sessions


urlpatterns = [
    # ===========================
    # AUTHENTICATION (Django built-in)
    # ===========================
    # Login/Logout handled via API or /admin/


    # ===========================
    # DASHBOARD + SESSION VIEWS (Django Templates)
    # ===========================
    path('dashboard/', dashboard, name='dashboard'),
    path('sessions/', sessions_list, name='sessions_list'),
    path('history/', history, name='history'),

    # Session detail page with real-time controls
    path('session/<uuid:uuid>/', session_detail, name='session_detail'),

    # HTMX Partials for real-time updates
    path('get-stage-controls/<uuid:uuid>/', get_stage_controls, name='get_stage_controls'),
    path('session-stepper/<uuid:uuid>/', get_session_stepper, name='get_session_stepper'),
    path('verified-data/<uuid:uuid>/', get_verified_data, name='get_verified_data'),
    path('current-submission/<uuid:uuid>/', get_current_submission, name='get_current_submission'),

    # ===========================
    # CRUD OPERATIONS (Django Templates)
    # ===========================
    path('sessions/confirm-delete-selected/', confirm_delete_selected, name='confirm_delete_selected'),
    path('sessions/delete-selected/', delete_selected_sessions, name='delete_selected_sessions'),

]
