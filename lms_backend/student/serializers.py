from rest_framework import serializers

from academics.models import Course
from accounts.serializers import UserSerializer
from faculty.models import LearningMaterial, Assignment, Submission, ExamMark, Attendance
from leave_management.models import LeaveRequest


# ===============================================================
# Dashboard (Stage 1)
# ===============================================================

class StudentCourseSerializer(serializers.ModelSerializer):
    faculty_username = serializers.SerializerMethodField()
    batch_name = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = ["id", "name", "code", "description", "faculty_username", "batch_name"]

    def get_faculty_username(self, obj):
        return obj.faculty.username if obj.faculty else None

    def get_batch_name(self, obj):
        return obj.batch.name if obj.batch else None


class StudentDashboardSerializer(serializers.Serializer):
    profile = UserSerializer()
    courses = StudentCourseSerializer(many=True)
    total_courses = serializers.IntegerField()
    pending_assignments_count = serializers.IntegerField()
    attendance_percentage_this_month = serializers.FloatField(allow_null=True)
    average_marks = serializers.FloatField(allow_null=True)


# ===============================================================
# Learning Materials (Stage 2, read-only)
# ===============================================================

class StudentLearningMaterialSerializer(serializers.ModelSerializer):
    course_name = serializers.CharField(source="course.name", read_only=True)
    course_code = serializers.CharField(source="course.code", read_only=True)

    class Meta:
        model = LearningMaterial
        fields = ["id", "course", "course_name", "course_code", "title", "file", "uploaded_at"]


# ===============================================================
# Assignments + Submission (Stage 3)
# ===============================================================

class StudentSubmissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Submission
        fields = ["id", "assignment", "file", "submitted_at", "grade", "feedback"]
        read_only_fields = ["id", "assignment", "file", "submitted_at", "grade", "feedback"]


class StudentAssignmentSerializer(serializers.ModelSerializer):
    course_name = serializers.CharField(source="course.name", read_only=True)
    course_code = serializers.CharField(source="course.code", read_only=True)
    submission = serializers.SerializerMethodField()

    class Meta:
        model = Assignment
        fields = [
            "id", "course", "course_name", "course_code",
            "title", "description", "due_date", "submission"
        ]

    def get_submission(self, obj):
        request = self.context.get("request")
        if not request:
            return None

        sub = Submission.objects.filter(assignment=obj, student=request.user).first()
        if not sub:
            return None

        return {
            "id": sub.id,
            "file": request.build_absolute_uri(sub.file.url) if sub.file else None,
            "submitted_at": sub.submitted_at,
            "grade": sub.grade,
            "feedback": sub.feedback,
            "is_late": (sub.submitted_at > obj.due_date) if obj.due_date else None,
        }


# ===============================================================
# Exam Marks (Stage 4, read-only)
# ===============================================================

class StudentExamMarkSerializer(serializers.ModelSerializer):
    course_name = serializers.CharField(source="course.name", read_only=True)
    course_code = serializers.CharField(source="course.code", read_only=True)

    class Meta:
        model = ExamMark
        fields = ["id", "course", "course_name", "course_code", "exam_type", "marks"]
        read_only_fields = fields


# ===============================================================
# Attendance (Stage 5, read-only)
# ===============================================================

class StudentAttendanceSerializer(serializers.ModelSerializer):
    course_name = serializers.CharField(source="course.name", read_only=True)
    course_code = serializers.CharField(source="course.code", read_only=True)

    class Meta:
        model = Attendance
        fields = ["id", "course", "course_name", "course_code", "date", "status"]
        read_only_fields = fields


# ===============================================================
# Leave Requests (Stage 6) — student submits + views own history,
# faculty reviews via faculty.StudentLeaveRequestViewSet.
# Mirrors faculty.FacultyLeaveRequestSerializer exactly.
# ===============================================================

class StudentLeaveRequestSerializer(serializers.ModelSerializer):
    reviewed_by_username = serializers.CharField(source="reviewed_by.username", read_only=True, default=None)

    class Meta:
        model = LeaveRequest
        fields = [
            "id", "reason", "start_date", "end_date",
            "status", "applied_at", "reviewed_by_username"
        ]
        read_only_fields = ["id", "status", "applied_at"]