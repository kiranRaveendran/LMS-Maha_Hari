from rest_framework import serializers

from .models import LeaveRequest


class AcademicManagerLeaveRequestSerializer(serializers.ModelSerializer):
    """
    Read side for the Academic Manager's leave list/detail views.
    Approve/Reject don't go through this serializer for input — they're
    plain no-body actions that just flip status + set reviewed_by — but
    it's used to shape the response after either action.
    """
    applicant_username = serializers.CharField(source="applicant.username", read_only=True)
    applicant_role = serializers.CharField(source="applicant.role", read_only=True)
    reviewed_by_username = serializers.CharField(source="reviewed_by.username", read_only=True, default=None)

    class Meta:
        model = LeaveRequest
        fields = [
            "id", "applicant", "applicant_username", "applicant_role",
            "reason", "start_date", "end_date",
            "status", "applied_at", "reviewed_by_username",
        ]
        read_only_fields = fields


class AcademicManagerOwnLeaveRequestSerializer(serializers.ModelSerializer):
    """
    Read/write serializer for the Academic Manager's own leave requests,
    submitted to Admin for review. Mirrors
    faculty.serializers.FacultyLeaveRequestSerializer exactly.

    status / reviewed_by are read-only here — every new request is
    locked to PENDING with no reviewer at the view level
    (AcademicManagerOwnLeaveViewSet.perform_create), same
    belt-and-suspenders approach as the Faculty side.
    """
    reviewed_by_username = serializers.CharField(source="reviewed_by.username", read_only=True, default=None)

    class Meta:
        model = LeaveRequest
        fields = [
            "id", "reason", "start_date", "end_date",
            "status", "applied_at", "reviewed_by_username",
        ]
        read_only_fields = ["id", "status", "applied_at"]