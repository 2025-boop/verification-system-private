# Template views module for agent dashboard
# Modularized views
from .dashboard_views import dashboard, sessions_list, history
from .session_views import session_detail
from .partial_views import (
    get_stage_controls,
    get_session_stepper,
    get_verified_data,
    get_current_submission,
)
from .crud_views import confirm_delete_selected, delete_selected_sessions



__all__ = [
    # Modularized views
    'dashboard',
    'sessions_list',
    'history',
    'session_detail',
    'get_stage_controls',
    'get_session_stepper',
    'get_verified_data',
    'get_current_submission',
    'confirm_delete_selected',
    'delete_selected_sessions',

]
