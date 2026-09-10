from rest_framework import serializers

from accounts.models import CustomUser

from .models import Batch, Course, StudentCourse, SyllabusTopic, Announcement


# ===============================================================
# Sprint 1, Day 3 — Batch CRUD
# ===============================================================

class BatchSerializer(serializers.ModelSerializer):
    course_count = serializers.SerializerMethodField()

    class Meta:
        model = Batch
        fields = ["id", "name", "start_date", "end_date", "course_count"]
        read_only_fields = ["id"]

    def get_course_count(self, obj):
        return obj.courses.count()

    def validate(self, data):
        start_date = data.get("start_date", getattr(self.instance, "start_date", None))
        end_date = data.get("end_date", getattr(self.instance, "end_date", None))
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError(
                {"end_date": "End date cannot be before start date."}
            )
        return data


# ===============================================================
# Sprint 1, Day 4 — Course CRUD
# ===============================================================

class CourseSerializer(serializers.ModelSerializer):
    faculty_username = serializers.CharField(source="faculty.username", read_only=True, default=None)
    batch_name = serializers.CharField(source="batch.name", read_only=True, default=None)
    enrolled_count = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            "id", "name", "code", "description",
            "faculty", "faculty_username",
            "batch", "batch_name",
            "enrolled_count",
        ]
        read_only_fields = ["id"]

    def get_enrolled_count(self, obj):
        return obj.studentcourse_set.count()

    def validate_faculty(self, faculty):
        if faculty is not None and getattr(faculty, "role", None) != "FACULTY":
            raise serializers.ValidationError(
                "Selected user is not a Faculty member."
            )
        return faculty


class CourseFacultyAllocationSerializer(serializers.ModelSerializer):
    """
    Sprint 1, Day 5 — Faculty-to-Course Allocation.
    Used only for the assign-faculty action: reassigns/clears
    Course.faculty without touching any other course field.
    """
    class Meta:
        model = Course
        fields = ["faculty"]

    def validate_faculty(self, faculty):
        if faculty is not None and getattr(faculty, "role", None) != "FACULTY":
            raise serializers.ValidationError(
                "Selected user is not a Faculty member."
            )
        return faculty


# ===============================================================
# Sprint 1, Day 5 — Student Enrollment (StudentCourse)
# ===============================================================

class StudentCourseSerializer(serializers.ModelSerializer):
    student_username = serializers.CharField(source="student.username", read_only=True)
    course_name = serializers.CharField(source="course.name", read_only=True)
    course_code = serializers.CharField(source="course.code", read_only=True)
    batch_name = serializers.SerializerMethodField()

    class Meta:
        model = StudentCourse
        fields = [
            "id", "student", "student_username",
            "course", "course_name", "course_code",
            "batch_name", "enrolled_on",
        ]
        read_only_fields = ["id", "enrolled_on"]

    def get_batch_name(self, obj):
        return obj.course.batch.name if obj.course.batch else None

    def validate_student(self, student):
        if getattr(student, "role", None) != "STUDENT":
            raise serializers.ValidationError(
                "Selected user is not a Student."
            )
        return student

    def validate(self, data):
        student = data.get("student")
        course = data.get("course")
        if student and course and StudentCourse.objects.filter(student=student, course=course).exists():
            raise serializers.ValidationError(
                "This student is already enrolled in this course."
            )
        return data


# ===============================================================
# Dropdown option lists (faculty/students) used by the
# Course, Allocation and Enrollment forms
# ===============================================================

class DropdownUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ["id", "username", "first_name", "last_name"]


# ===============================================================
# Sprint 2, Day 1 — Syllabus Topic CRUD
# ===============================================================

class SyllabusTopicSerializer(serializers.ModelSerializer):
    course_name = serializers.CharField(source="course.name", read_only=True)
    course_code = serializers.CharField(source="course.code", read_only=True)

    class Meta:
        model = SyllabusTopic
        fields = [
            "id", "course", "course_name", "course_code",
            "session_number", "topic_name", "status",
        ]
        read_only_fields = ["id"]


# ===============================================================
# Sprint 2, Day 2 — Announcement CRUD
# ===============================================================

class AnnouncementSerializer(serializers.ModelSerializer):
    course_name = serializers.CharField(source="course.name", read_only=True)
    course_code = serializers.CharField(source="course.code", read_only=True)

    class Meta:
        model = Announcement
        fields = [
            "id", "course", "course_name", "course_code",
            "title", "message", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


# ===============================================================
# Sprint 2, Day 4 — Academic Manager Dashboard Statistics
# ===============================================================

class AcademicManagerDashboardStatsSerializer(serializers.Serializer):
    total_courses = serializers.IntegerField()
    total_batches = serializers.IntegerField()
    total_faculty = serializers.IntegerField()
    total_students = serializers.IntegerField()
    total_enrollments = serializers.IntegerField()
    pending_leave_requests = serializers.IntegerField()