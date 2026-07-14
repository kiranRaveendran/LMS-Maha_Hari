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
    class Meta:
        model = Course
        fields = ["id", "name", "code", "description"]


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