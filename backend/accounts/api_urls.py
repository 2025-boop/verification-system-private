# accounts/api_urls.py
from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.views import TokenVerifyView
from accounts.views_migration.testing import protected_test


urlpatterns = [
    # JWT Authentication Endpoints
    path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('token/verify/', TokenVerifyView.as_view(), name='token_verify'),



    # Testing Endpoints
    path("protected-test/", protected_test),
]