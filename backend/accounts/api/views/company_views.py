"""
Company API Endpoints
=====================

REST API endpoints for listing companies and their details.
Allows frontend to discover available companies and their branding info.

Endpoints:
- GET  /api/companies/         - List all companies
- GET  /api/companies/{id}/    - Get single company details
"""

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
import logging

from accounts.models import Company
from accounts.api.serializers import CompanyListSerializer, CompanyDetailSerializer
from accounts.api.permissions import IsStaffUser


logger = logging.getLogger(__name__)


class CompanyViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoints for retrieving company information.

    List companies and their branding/email configuration.
    Frontend uses this to build company dropdown and fetch branding details.

    Returns basic info for list view, detailed info for individual company.
    """
    queryset = Company.objects.all().order_by('name')
    permission_classes = [IsAuthenticated, IsStaffUser]

    def get_serializer_class(self):
        """Use detail serializer for retrieve, list serializer for list"""
        if self.action == 'retrieve':
            return CompanyDetailSerializer
        return CompanyListSerializer
