from rest_framework import serializers

from academics.models import Course
from accounts.serializers import UserSerializer


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