from django.shortcuts import render

# Create your views here.
from rest_framework import viewsets, mixins
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action

from accounts.permissions import IsAcademicManager
from accounts.pagination import StandardResultsPagination

from leave_management.models import LeaveRequest
from .serializers import AcademicManagerLeaveRequestSerializer


class AcademicManagerLeaveRequestViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """
    View pending / all leave requests, and Approve / Reject them.
    No create/delete here — leave requests are created by the
    applicant, the Academic Manager only ever reviews.

    Scoped to Faculty applicants only. This mirrors the rest of the
    review hierarchy already established elsewhere in the project:
    Student leave -> reviewed by Faculty (faculty.StudentLeaveRequestViewSet),
    Faculty leave -> reviewed by Academic Manager (here),
    Academic Manager leave -> reviewed by Admin
    (accounts.AdminLeaveRequestViewSet, filtered to applicant__role=
    "ACADEMIC_MANAGER"). Without this filter an Academic Manager could
    action Student or even other Academic Managers' requests, which
    isn't the intended review chain.

    GET   /api/academic-manager/leave-requests/               (optionally ?status=PENDING&search=&page=&limit=)
    GET   /api/academic-manager/leave-requests/{id}/
    PATCH /api/academic-manager/leave-requests/{id}/approve/
    PATCH /api/academic-manager/leave-requests/{id}/reject/
    """
    serializer_class = AcademicManagerLeaveRequestSerializer
    permission_classes = [IsAuthenticated, IsAcademicManager]
    pagination_class = StandardResultsPagination

    def get_queryset(self):
        queryset = (
            LeaveRequest.objects
            .filter(applicant__role="FACULTY")
            .select_related("applicant", "reviewed_by")
            .order_by("-applied_at")
        )

        status_param = self.request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param.upper())

        return queryset

    @action(detail=True, methods=["patch"], url_path="approve")
    def approve(self, request, pk=None):
        leave_request = self.get_object()
        leave_request.status = "APPROVED"
        leave_request.reviewed_by = request.user
        leave_request.save(update_fields=["status", "reviewed_by"])
        return Response(AcademicManagerLeaveRequestSerializer(leave_request).data)

    @action(detail=True, methods=["patch"], url_path="reject")
    def reject(self, request, pk=None):
        leave_request = self.get_object()
        leave_request.status = "REJECTED"
        leave_request.reviewed_by = request.user
        leave_request.save(update_fields=["status", "reviewed_by"])
        return Response(AcademicManagerLeaveRequestSerializer(leave_request).data)