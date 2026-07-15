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