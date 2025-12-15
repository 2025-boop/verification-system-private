# accounts/api/permissions.py
"""
Custom permission classes for Control Room API
"""

from rest_framework import permissions
from accounts.models import Session


class IsSessionAgent(permissions.BasePermission):
    """
    Permission to check if the user is the agent assigned to this session.
    Used to ensure agents can only access/modify their own sessions.
    """

    def has_object_permission(self, request, view, obj):
        """Check if user is the session's agent"""
        if isinstance(obj, Session):
            return obj.agent == request.user
        return False


class IsStaffUser(permissions.BasePermission):
    """
    Permission to check if the user is a staff member.
    Used to restrict WebSocket and dashboard access to staff only.
    """

    def has_permission(self, request, view):
        """Check if user is authenticated and is_staff"""
        return request.user and request.user.is_authenticated and request.user.is_staff
