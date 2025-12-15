# control_room/urls.py 
from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView
from django.http import JsonResponse

def health_check(request):
    """Simple JSON health check for the root URL"""
    return JsonResponse({
        "status": "ok",
        "service": "Control Room API",
        "version": "1.0.0",
        "message": "Welcome to the API. Documentation available at /api/docs/ (if configured)."
    })

urlpatterns = [
    path('admin/', admin.site.urls),

    # REST API routes for React/Next.js frontend
    # Includes: auth, sessions, user flow, agent actions, controls, utilities
    path('api/', include('accounts.api.urls')),

    # Django template views for agent dashboard
    # Includes: HTML rendering, HTMX partials, form handling
    path('accounts/', include('accounts.urls')),

    # Home redirect
    # Home - Clean API Health Check
    path('', health_check, name='api_root'),
]