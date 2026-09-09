from rest_framework import serializers

from .models import Feedback


# ===============================================================
# Student side — submit feedback/concerns to an Academic Manager,
# view the response once one comes in.
# ===============================================================

class StudentFeedbackSerializer(serializers.ModelSerializer):
    academic_manager_username = serializers.CharField(source="academic_manager.username", read_only=True)

    class Meta:
        model = Feedback
        fields = [
            "id", "academic_manager", "academic_manager_username",
            "message", "created_at", "response", "responded_at",
        ]
        read_only_fields = ["id", "created_at", "response", "responded_at"]

    def validate_academic_manager(self, value):
        if value.role != "ACADEMIC_MANAGER":
            raise serializers.ValidationError("Feedback can only be sent to an Academic Manager.")
        return value


# ===============================================================
# Academic Manager side — view feedback addressed to them, respond.
# ===============================================================

class AcademicManagerFeedbackSerializer(serializers.ModelSerializer):
    """Read side — everything about the feedback, including the student who sent it."""
    student_username = serializers.CharField(source="student.username", read_only=True)

    class Meta:
        model = Feedback
        fields = [
            "id", "student", "student_username",
            "message", "created_at", "response", "responded_at",
        ]
        read_only_fields = fields


class AcademicManagerFeedbackResponseSerializer(serializers.ModelSerializer):
    """Used only for PATCH — an Academic Manager can only write `response`;
    `responded_at` is stamped server-side in perform_update, never client-settable."""

    class Meta:
        model = Feedback
        fields = ["response"]
