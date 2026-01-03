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


class IsSuperuserOrSessionOwner(permissions.BasePermission):
    """
    Permission for session-based access control.
    
    - Superusers can access ANY session (admin oversight)
    - Agents can only access sessions where they are the assigned agent
    
    Use this permission class for all session-related endpoints.
    """

    def has_permission(self, request, view):
        """Check if user is authenticated"""
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        """
        Check if user can access this specific session.
        
        Superusers: Always allowed
        Agents: Only if they own the session
        """
        # Superusers can access any session
        if request.user.is_superuser:
            return True
        
        # For Session objects, check agent ownership
        if isinstance(obj, Session):
            return obj.agent == request.user
        
        return False
