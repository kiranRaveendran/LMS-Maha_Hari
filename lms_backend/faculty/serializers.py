from rest_framework import serializers

from academics.models import Course
from accounts.models import CustomUser
from leave_management.models import LeaveRequest

from .models import (
    LearningMaterial, Assignment, Submission, Attendance, ExamMark
)


# ===============================================================
# Dashboard (Stage 1 + 8)
# ===============================================================

class FacultyProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = [
            "id", "username", "first_name", "last_name", "email",
            "phone", "profile_image", "employee_id", "qualification",
            "gender", "joining_date", "address",
        ]


class FacultyCourseSerializer(serializers.ModelSerializer):
    batch_name = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = ["id", "name", "code", "description", "batch_name"]

    def get_batch_name(self, obj):
        return obj.batch.name if obj.batch else None


class FacultyCourseStatsSerializer(serializers.Serializer):
    course_id = serializers.IntegerField()
    course_name = serializers.CharField()
    course_code = serializers.CharField()
    attendance_percentage_this_month = serializers.FloatField(allow_null=True)
    average_marks = serializers.FloatField(allow_null=True)


class FacultyDashboardSerializer(serializers.Serializer):
    profile = FacultyProfileSerializer()
    courses = FacultyCourseSerializer(many=True)
    total_courses = serializers.IntegerField()
    total_students = serializers.IntegerField()
    total_assignments = serializers.IntegerField()
    total_learning_materials = serializers.IntegerField()
    pending_grading_count = serializers.IntegerField()
    course_breakdown = FacultyCourseStatsSerializer(many=True)


# ===============================================================
# Learning Materials (Stage 2)
# ===============================================================

class LearningMaterialSerializer(serializers.ModelSerializer):
    class Meta:
        model = LearningMaterial
        fields = ["id", "course", "title", "file", "uploaded_at"]
        read_only_fields = ["id", "uploaded_at"]

    def validate_course(self, course):
        request = self.context.get("request")
        if request and course.faculty_id != request.user.id:
            raise serializers.ValidationError(
                "You can only upload materials for your own courses."
            )
        return course


# ===============================================================
# Assignments (Stage 3)
# ===============================================================

class AssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Assignment
        fields = ["id", "course", "title", "description", "due_date"]
        read_only_fields = ["id"]

    def validate_course(self, course):
        request = self.context.get("request")
        if request and course.faculty_id != request.user.id:
            raise serializers.ValidationError(
                "You can only create assignments for your own courses."
            )
        return course


# ===============================================================
# Submission Review & Grading (Stage 4)
# ===============================================================

class SubmissionSerializer(serializers.ModelSerializer):
    student_username = serializers.CharField(source="student.username", read_only=True)
    assignment_title = serializers.CharField(source="assignment.title", read_only=True)

    class Meta:
        model = Submission
        fields = [
            "id", "assignment", "assignment_title", "student", "student_username",
            "file", "submitted_at", "grade", "feedback"
        ]
        read_only_fields = ["id", "assignment", "student", "file", "submitted_at"]


class SubmissionGradeSerializer(serializers.ModelSerializer):
    """Used only for PATCH — faculty can update grade/feedback, nothing else."""

    grade = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=0, max_value=100)

    class Meta:
        model = Submission
        fields = ["grade", "feedback"]


# ===============================================================
# Attendance (Stage 5)
# ===============================================================

class AttendanceSerializer(serializers.ModelSerializer):
    student_username = serializers.CharField(source="student.username", read_only=True)

    class Meta:
        model = Attendance
        fields = ["id", "course", "student", "student_username", "date", "status"]
        read_only_fields = ["id"]

    def validate_course(self, course):
        request = self.context.get("request")
        if request and course.faculty_id != request.user.id:
            raise serializers.ValidationError(
                "You can only manage attendance for your own courses."
            )
        return course


# ===============================================================
# Exam Marks (Stage 6)
# ===============================================================

class ExamMarkSerializer(serializers.ModelSerializer):
    student_username = serializers.CharField(source="student.username", read_only=True)
    marks = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=0, max_value=100)

    class Meta:
        model = ExamMark
        fields = ["id", "course", "student", "student_username", "exam_type", "marks"]
        read_only_fields = ["id"]

    def validate_course(self, course):
        request = self.context.get("request")
        if request and course.faculty_id != request.user.id:
            raise serializers.ValidationError(
                "You can only manage marks for your own courses."
            )
        return course


# ===============================================================
# Leave History (Stage 7, read-only)
# ===============================================================

class FacultyLeaveRequestSerializer(serializers.ModelSerializer):
    reviewed_by_username = serializers.CharField(source="reviewed_by.username", read_only=True, default=None)

    class Meta:
        model = LeaveRequest
        fields = [
            "id", "reason", "start_date", "end_date",
            "status", "applied_at", "reviewed_by_username"
        ]
        read_only_fields = ["id", "status", "applied_at"]


class StudentLeaveRequestSerializer(serializers.ModelSerializer):
    """Faculty-facing view of a student's leave request — read side."""
    applicant_username = serializers.CharField(source="applicant.username", read_only=True)

    class Meta:
        model = LeaveRequest
        fields = [
            "id", "applicant", "applicant_username", "reason",
            "start_date", "end_date", "status", "applied_at"
        ]
        read_only_fields = ["id", "applicant", "reason", "start_date", "end_date", "applied_at"]


class StudentLeaveReviewSerializer(serializers.ModelSerializer):
    """Used only for PATCH — faculty can only set status, nothing else."""

    class Meta:
        model = LeaveRequest
        fields = ["status"]

    def validate_status(self, value):
        if value not in ("APPROVED", "REJECTED"):
            raise serializers.ValidationError("Status must be APPROVED or REJECTED.")
        return value