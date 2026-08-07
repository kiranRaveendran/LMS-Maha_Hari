from rest_framework import serializers
from .models import CustomUser


class AcademicManagerSerializer(serializers.ModelSerializer):

    class Meta:
        model = CustomUser
        fields = [
            "id",
            "username",
            "email",
            "phone",
            "role",
            "password",
        ]
        extra_kwargs = {
            "password": {"write_only": True}
        }

    def create(self, validated_data):
        password = validated_data.pop("password")

        user = CustomUser(**validated_data)
        user.set_password(password)
        user.role = CustomUser.Role.ACADEMIC_MANAGER
        user.save()

        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)

        for key, value in validated_data.items():
            setattr(instance, key, value)

        if password:
            instance.set_password(password)

        instance.save()

        return instance
    

from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


class FacultySerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        style={"input_type": "password"}
    )

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "phone",
            "password",
        ]

    def validate_phone(self, value):
        if not value:
            raise serializers.ValidationError("Phone number is required.")

        if not value.isdigit() or len(value) != 10:
            raise serializers.ValidationError(
                "Phone number must be exactly 10 digits."
            )

        return value

    def create(self, validated_data):
        password = validated_data.pop("password")

        user = User(
            role=User.Role.FACULTY,
            **validated_data
        )

        user.set_password(password)
        user.save()

        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        instance.save()

        return instance
    

class StudentSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        style={"input_type": "password"}
    )

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "phone",
            "password",
        ]

    def validate_phone(self, value):
        if not value:
            raise serializers.ValidationError(
                "Phone number is required."
            )

        if not value.isdigit() or len(value) != 10:
            raise serializers.ValidationError(
                "Phone number must be exactly 10 digits."
            )

        return value

    def create(self, validated_data):
        password = validated_data.pop("password")

        user = User(
            role=User.Role.STUDENT,
            **validated_data
        )

        user.set_password(password)
        user.save()

        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        instance.save()

        return instance
    

#new

class DashboardStatsSerializer(serializers.Serializer):
    total_students = serializers.IntegerField()
    total_faculty = serializers.IntegerField()
    total_academic_managers = serializers.IntegerField()
    total_courses = serializers.IntegerField()
    pending_leave_requests = serializers.IntegerField()


from academics.models import Course
from leave_management.models import LeaveRequest


class AdminCourseSerializer(serializers.ModelSerializer):
    faculty_username = serializers.SerializerMethodField()
    batch_name = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = ["id", "name", "code", "description", "faculty_username", "batch_name"]

    def get_faculty_username(self, obj):
        return obj.faculty.username if obj.faculty else None

    def get_batch_name(self, obj):
        return obj.batch.name if obj.batch else None


class AdminLeaveRequestSerializer(serializers.ModelSerializer):
    applicant_username = serializers.CharField(source="applicant.username", read_only=True)

    class Meta:
        model = LeaveRequest
        fields = ["id", "applicant", "applicant_username", "reason", "start_date", "end_date", "status", "applied_at"]
        read_only_fields = ["id", "applicant", "reason", "start_date", "end_date", "applied_at"]


class AdminLeaveReviewSerializer(serializers.ModelSerializer):
    """PATCH-only — Admin can set status, nothing else."""
    class Meta:
        model = LeaveRequest
        fields = ["status"]

    def validate_status(self, value):
        if value not in ("APPROVED", "REJECTED"):
            raise serializers.ValidationError("Status must be APPROVED or REJECTED.")
        return value




from rest_framework import serializers

from academics.models import Course
from leave_management.models import LeaveRequest


# ===============================================================
# Admin Course oversight (read-only)
# ===============================================================

class AdminCourseSerializer(serializers.ModelSerializer):
    faculty_username = serializers.SerializerMethodField()
    batch_id = serializers.SerializerMethodField()
    batch_name = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = ["id", "name", "code", "description", "faculty_username", "batch_id", "batch_name"]

    def get_faculty_username(self, obj):
        return obj.faculty.username if obj.faculty else None

    def get_batch_id(self, obj):
        return obj.batch.id if obj.batch else None

    def get_batch_name(self, obj):
        return obj.batch.name if obj.batch else None


# ===============================================================
# Admin Leave Requests — Academic Manager requests only
# ===============================================================

class AdminLeaveRequestSerializer(serializers.ModelSerializer):
    applicant_username = serializers.CharField(source="applicant.username", read_only=True)

    class Meta:
        model = LeaveRequest
        fields = ["id", "applicant", "applicant_username", "reason", "start_date", "end_date", "status", "applied_at"]
        read_only_fields = ["id", "applicant", "reason", "start_date", "end_date", "applied_at"]


class AdminLeaveReviewSerializer(serializers.ModelSerializer):
    """PATCH-only — Admin can set status, nothing else."""
    class Meta:
        model = LeaveRequest
        fields = ["status"]

    def validate_status(self, value):
        if value not in ("APPROVED", "REJECTED"):
            raise serializers.ValidationError("Status must be APPROVED or REJECTED.")
        return value


# ===============================================================
# Admin Student Performance Analysis — course-level and batch-level
# ===============================================================

class AdminStudentPerformanceSerializer(serializers.Serializer):
    student_id = serializers.IntegerField()
    username = serializers.CharField()
    attendance_percentage = serializers.FloatField(allow_null=True)
    average_marks = serializers.FloatField(allow_null=True)


class AdminCoursePerformanceSerializer(serializers.Serializer):
    course_id = serializers.IntegerField()
    course_name = serializers.CharField()
    course_code = serializers.CharField()
    faculty_username = serializers.CharField(allow_null=True)
    class_average_attendance = serializers.FloatField(allow_null=True)
    class_average_marks = serializers.FloatField(allow_null=True)
    students = AdminStudentPerformanceSerializer(many=True)


class AdminBatchCourseSummarySerializer(serializers.Serializer):
    course_id = serializers.IntegerField()
    course_name = serializers.CharField()
    course_code = serializers.CharField()
    class_average_attendance = serializers.FloatField(allow_null=True)
    class_average_marks = serializers.FloatField(allow_null=True)


class AdminBatchPerformanceSerializer(serializers.Serializer):
    batch_id = serializers.IntegerField()
    batch_name = serializers.CharField()
    overall_average_attendance = serializers.FloatField(allow_null=True)
    overall_average_marks = serializers.FloatField(allow_null=True)
    courses = AdminBatchCourseSummarySerializer(many=True)



# new_


from rest_framework import serializers

from academics.models import Course
from leave_management.models import LeaveRequest


# ===============================================================
# Admin Course oversight (read-only)
# ===============================================================

class AdminCourseSerializer(serializers.ModelSerializer):
    faculty_username = serializers.SerializerMethodField()
    batch_id = serializers.SerializerMethodField()
    batch_name = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = ["id", "name", "code", "description", "faculty_username", "batch_id", "batch_name"]

    def get_faculty_username(self, obj):
        return obj.faculty.username if obj.faculty else None

    def get_batch_id(self, obj):
        return obj.batch.id if obj.batch else None

    def get_batch_name(self, obj):
        return obj.batch.name if obj.batch else None


# ===============================================================
# Admin Leave Requests — Academic Manager requests only
# ===============================================================

class AdminLeaveRequestSerializer(serializers.ModelSerializer):
    applicant_username = serializers.CharField(source="applicant.username", read_only=True)

    class Meta:
        model = LeaveRequest
        fields = ["id", "applicant", "applicant_username", "reason", "start_date", "end_date", "status", "applied_at"]
        read_only_fields = ["id", "applicant", "reason", "start_date", "end_date", "applied_at"]


class AdminLeaveReviewSerializer(serializers.ModelSerializer):
    """PATCH-only — Admin can set status, nothing else."""
    class Meta:
        model = LeaveRequest
        fields = ["status"]

    def validate_status(self, value):
        if value not in ("APPROVED", "REJECTED"):
            raise serializers.ValidationError("Status must be APPROVED or REJECTED.")
        return value


# ===============================================================
# Admin Student Performance Analysis — course-level and batch-level
# ===============================================================

class AdminStudentPerformanceSerializer(serializers.Serializer):
    student_id = serializers.IntegerField()
    username = serializers.CharField()
    attendance_percentage = serializers.FloatField(allow_null=True)
    average_marks = serializers.FloatField(allow_null=True)


class AdminCoursePerformanceSerializer(serializers.Serializer):
    course_id = serializers.IntegerField()
    course_name = serializers.CharField()
    course_code = serializers.CharField()
    faculty_username = serializers.CharField(allow_null=True)
    class_average_attendance = serializers.FloatField(allow_null=True)
    class_average_marks = serializers.FloatField(allow_null=True)
    students = AdminStudentPerformanceSerializer(many=True)


class AdminBatchCourseSummarySerializer(serializers.Serializer):
    course_id = serializers.IntegerField()
    course_name = serializers.CharField()
    course_code = serializers.CharField()
    class_average_attendance = serializers.FloatField(allow_null=True)
    class_average_marks = serializers.FloatField(allow_null=True)


class AdminBatchPerformanceSerializer(serializers.Serializer):
    batch_id = serializers.IntegerField()
    batch_name = serializers.CharField()
    overall_average_attendance = serializers.FloatField(allow_null=True)
    overall_average_marks = serializers.FloatField(allow_null=True)
    courses = AdminBatchCourseSummarySerializer(many=True)