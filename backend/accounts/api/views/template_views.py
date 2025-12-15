"""
Email Template API Endpoints
=============================

REST API endpoints for frontend to discover and retrieve email templates.
Allows frontend to build dynamic template selection UI for agents.

Endpoints:
- GET  /api/companies/{company_id}/email-templates/       - List templates for company
- GET  /api/companies/{company_id}/email-templates/{id}/  - Get single template details
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
import logging

from accounts.models import Company, EmailTemplate
from accounts.api.serializers import EmailTemplateListSerializer, EmailTemplateDetailSerializer
from accounts.api.permissions import IsStaffUser


logger = logging.getLogger(__name__)


class EmailTemplateViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoints for retrieving email templates.

    List templates for a company or get single template details.
    Frontend uses this to build dropdown/preview UI for agents.

    Only returns active templates by default (unless is_draft filter is used).
    """
    permission_classes = [IsAuthenticated, IsStaffUser]

    def get_serializer_class(self):
        """Use detail serializer for retrieve, list serializer for list"""
        if self.action == 'retrieve':
            return EmailTemplateDetailSerializer
        return EmailTemplateListSerializer

    def get_queryset(self):
        """
        Filter templates by company_id from URL parameter.
        Only return active templates unless ?include_drafts=true
        """
        company_id = self.kwargs.get('company_id')
        queryset = EmailTemplate.objects.filter(company_id=company_id)

        # Filter by active status unless drafts are explicitly requested
        include_drafts = self.request.query_params.get('include_drafts', 'false').lower() == 'true'
        if not include_drafts:
            queryset = queryset.filter(is_active=True)

        return queryset.order_by('template_type', '-created_at')

    @action(detail=False, methods=['get'])
    def by_type(self, request, company_id=None):
        """
        Get templates grouped by type.

        Query params:
        - ?include_drafts=true  (include draft templates)

        Response:
        {
            "verification_link": [
                { id, name, description, ... }
            ],
            "stage_update": [
                { id, name, description, ... }
            ],
            ...
        }
        """
        company = get_object_or_404(Company, id=company_id)

        include_drafts = request.query_params.get('include_drafts', 'false').lower() == 'true'
        queryset = EmailTemplate.objects.filter(company=company)

        if not include_drafts:
            queryset = queryset.filter(is_active=True)

        # Group by template type
        grouped = {}
        for template_type, display_name in EmailTemplate.TEMPLATE_TYPE_CHOICES:
            templates = queryset.filter(template_type=template_type)
            if templates.exists():
                grouped[template_type] = EmailTemplateListSerializer(templates, many=True).data

        return Response({
            'company_id': company.id,
            'company_name': company.name,
            'templates_by_type': grouped
        })
