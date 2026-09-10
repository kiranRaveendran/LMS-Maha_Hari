from django.shortcuts import render

# Create your views here.
from django.utils import timezone

from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsStudent, IsAcademicManager
from accounts.pagination import StandardResultsPagination

from .models import Feedback
from .serializers import (
    StudentFeedbackSerializer,
    AcademicManagerFeedbackSerializer, AcademicManagerFeedbackResponseSerializer,
)


# ===============================================================
# Student — submit feedback/concerns, view responses.
# No update/delete: once sent, a message is a permanent record,
# same reasoning as leave requests that have already been reviewed.
# ===============================================================

class StudentFeedbackViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin,
    mixins.CreateModelMixin, viewsets.GenericViewSet,
):
    """
    GET  /api/student/feedback/
    GET  /api/student/feedback/{id}/
    POST /api/student/feedback/
    """
    serializer_class = StudentFeedbackSerializer
    permission_classes = [IsAuthenticated, IsStudent]

    def get_queryset(self):
        return (
            Feedback.objects
            .filter(student=self.request.user)
            .select_related("academic_manager")
            .order_by("-created_at")
        )

    def perform_create(self, serializer):
        serializer.save(student=self.request.user)


# ===============================================================
# Academic Manager — view feedback addressed to them, respond.
# ===============================================================

class AcademicManagerFeedbackViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin, viewsets.GenericViewSet,
):
    """
    GET   /api/academic-manager/feedback/            (optionally ?status=pending|responded)
    GET   /api/academic-manager/feedback/{id}/
    PATCH /api/academic-manager/feedback/{id}/         (response only)
    """
    permission_classes = [IsAuthenticated, IsAcademicManager]
    pagination_class = StandardResultsPagination
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        queryset = (
            Feedback.objects
            .filter(academic_manager=self.request.user)
            .select_related("student")
            .order_by("-created_at")
        )

        status_param = self.request.query_params.get("status")
        if status_param == "pending":
            queryset = queryset.filter(responded_at__isnull=True)
        elif status_param == "responded":
            queryset = queryset.filter(responded_at__isnull=False)

        return queryset

    def get_serializer_class(self):
        if self.action == "partial_update":
            return AcademicManagerFeedbackResponseSerializer
        return AcademicManagerFeedbackSerializer

    def perform_update(self, serializer):
        serializer.save(responded_at=timezone.now())

    def partial_update(self, request, *args, **kwargs):
        super().partial_update(request, *args, **kwargs)
        instance = self.get_object()
        return Response(AcademicManagerFeedbackSerializer(instance).data)
