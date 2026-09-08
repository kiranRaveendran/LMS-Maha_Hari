from django.shortcuts import render

# Create your views here.
from rest_framework import viewsets, mixins
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action

from accounts.permissions import IsAcademicManager
from accounts.pagination import StandardResultsPagination

from leave_management.models import LeaveRequest
from .serializers import AcademicManagerLeaveRequestSerializer, AcademicManagerOwnLeaveRequestSerializer


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

# ===============================================================
# Academic Manager's own leave (view history + submit new requests)
# Mirrors faculty.views.FacultyLeaveHistoryViewSet exactly. These
# requests are reviewed by Admin — see
# accounts.views.AdminLeaveRequestViewSet, filtered to
# applicant__role="ACADEMIC_MANAGER".
# ===============================================================

class AcademicManagerOwnLeaveViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin,
    mixins.CreateModelMixin, mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    Academic Manager view their own leave history, submit new leave
    requests to Admin, and withdraw (delete) a request only while
    it's still PENDING — once reviewed, it becomes a permanent record
    and can't be deleted.

    GET    /api/academic-manager/leave-history/
    GET    /api/academic-manager/leave-history/{id}/
    POST   /api/academic-manager/leave-history/
    DELETE /api/academic-manager/leave-history/{id}/   (PENDING only)
    """
    serializer_class = AcademicManagerOwnLeaveRequestSerializer
    permission_classes = [IsAuthenticated, IsAcademicManager]

    def get_queryset(self):
        return (
            LeaveRequest.objects
            .filter(applicant=self.request.user)
            .select_related("reviewed_by")
            .order_by("-applied_at")
        )

    def perform_create(self, serializer):
        # status/reviewed_by are deliberately not client-settable — every
        # new request starts PENDING with no reviewer, regardless of what
        # the request body contains (the serializer already locks status
        # read-only, this is a second, redundant guarantee at the view level).
        serializer.save(applicant=self.request.user, status="PENDING", reviewed_by=None)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status != "PENDING":
            return Response(
                {"detail": "Only pending requests can be withdrawn. This request has already been reviewed."},
                status=400
            )
        return super().destroy(request, *args, **kwargs)
