from rest_framework import serializers
from academics.models import Course
from accounts.models import CustomUser


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


class FacultyDashboardSerializer(serializers.Serializer):
    profile = FacultyProfileSerializer()
    courses = FacultyCourseSerializer(many=True)
    total_courses = serializers.IntegerField()
    total_students = serializers.IntegerField()
    total_assignments = serializers.IntegerField()
    total_learning_materials = serializers.IntegerField()
    pending_grading_count = serializers.IntegerField()
    attendance_percentage_this_month = serializers.FloatField(allow_null=True)
    average_marks = serializers.FloatField(allow_null=True)

from faculty.models import LearningMaterial


class LearningMaterialSerializer(serializers.ModelSerializer):
    class Meta:
        model = LearningMaterial
        fields = ["id", "course", "title", "file", "uploaded_at"]
        read_only_fields = ["id", "uploaded_at"]

    def validate_course(self, course):
        # Prevents a faculty member from uploading material to a
        # course that isn't theirs, even if they know its ID.
        request = self.context.get("request")
        if request and course.faculty_id != request.user.id:
            raise serializers.ValidationError(
                "You can only upload materials for your own courses."
            )
        return course
    
from faculty.models import Assignment


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
    
    
from faculty.models import Submission


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
    class Meta:
        model = Submission
        fields = ["grade", "feedback"]


from faculty.models import Attendance


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
    


from faculty.models import ExamMark


class ExamMarkSerializer(serializers.ModelSerializer):
    student_username = serializers.CharField(source="student.username", read_only=True)

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
    

from leave_management.models import LeaveRequest


class FacultyLeaveRequestSerializer(serializers.ModelSerializer):
    reviewed_by_username = serializers.CharField(source="reviewed_by.username", read_only=True, default=None)

    class Meta:
        model = LeaveRequest
        fields = [
            "id", "reason", "start_date", "end_date",
            "status", "applied_at", "reviewed_by_username"
        ]