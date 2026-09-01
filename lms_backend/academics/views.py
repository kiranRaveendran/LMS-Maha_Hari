from django.shortcuts import render

# Create your views here.
from rest_framework import viewsets, mixins
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter, OrderingFilter

from accounts.models import CustomUser
from accounts.permissions import IsAcademicManager
from accounts.pagination import StandardResultsPagination
from leave_management.models import LeaveRequest

from .models import Batch, Course, StudentCourse, SyllabusTopic, Announcement
from .serializers import (
    BatchSerializer,
    CourseSerializer,
    CourseFacultyAllocationSerializer,
    StudentCourseSerializer,
    DropdownUserSerializer,
    SyllabusTopicSerializer,
    AnnouncementSerializer,
    AcademicManagerDashboardStatsSerializer,
)


# ===============================================================
# Sprint 1, Day 3 — Batch CRUD
# ===============================================================

class BatchViewSet(viewsets.ModelViewSet):
    """
    GET    /api/academic-manager/batches/          (?search=&ordering=&page=&limit=)
    POST   /api/academic-manager/batches/
    GET    /api/academic-manager/batches/{id}/
    PATCH  /api/academic-manager/batches/{id}/
    DELETE /api/academic-manager/batches/{id}/
    """
    serializer_class = BatchSerializer
    permission_classes = [IsAuthenticated, IsAcademicManager]
    queryset = Batch.objects.all().order_by("name")
    pagination_class = StandardResultsPagination
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["name"]
    ordering_fields = ["name", "start_date", "end_date"]


# ===============================================================
# Sprint 1, Day 4 — Course CRUD
# Sprint 1, Day 5 — Faculty-to-Course Allocation (assign-faculty action)
# ===============================================================

class CourseViewSet(viewsets.ModelViewSet):
    """
    GET    /api/academic-manager/courses/                (optionally ?batch=<id>&faculty=<id>&search=&ordering=&page=&limit=)
    POST   /api/academic-manager/courses/
    GET    /api/academic-manager/courses/{id}/
    PATCH  /api/academic-manager/courses/{id}/
    DELETE /api/academic-manager/courses/{id}/
    PATCH  /api/academic-manager/courses/{id}/assign-faculty/
    """
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated, IsAcademicManager]
    pagination_class = StandardResultsPagination
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["name", "code", "faculty__username"]
    ordering_fields = ["name", "code"]

    def get_queryset(self):
        queryset = Course.objects.select_related("faculty", "batch").order_by("name")

        batch_id = self.request.query_params.get("batch")
        faculty_id = self.request.query_params.get("faculty")

        if batch_id:
            queryset = queryset.filter(batch_id=batch_id)
        if faculty_id:
            queryset = queryset.filter(faculty_id=faculty_id)

        return queryset

    @action(detail=True, methods=["patch"], url_path="assign-faculty")
    def assign_faculty(self, request, pk=None):
        """
        Body: { "faculty": <id or null> }
        Reassigns (or clears, if null) the faculty member teaching
        this course, without touching name/code/description/batch.
        """
        course = self.get_object()
        serializer = CourseFacultyAllocationSerializer(course, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(CourseSerializer(course).data)


# ===============================================================
# Sprint 1, Day 5 — Student Enrollment (StudentCourse)
# No update endpoint by design: to change a student's course,
# delete the enrollment and create a new one rather than mutating
# an existing enrolled_on/course pairing in place.
# ===============================================================

class StudentCourseViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    GET    /api/academic-manager/enrollments/          (optionally ?course=<id>&batch=<id>&student=<id>&search=&ordering=&page=&limit=)
    POST   /api/academic-manager/enrollments/
    GET    /api/academic-manager/enrollments/{id}/
    DELETE /api/academic-manager/enrollments/{id}/
    """
    serializer_class = StudentCourseSerializer
    permission_classes = [IsAuthenticated, IsAcademicManager]
    pagination_class = StandardResultsPagination
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["student__username", "course__name", "course__code"]
    ordering_fields = ["enrolled_on"]

    def get_queryset(self):
        queryset = (
            StudentCourse.objects
            .select_related("student", "course", "course__batch")
            .order_by("-enrolled_on")
        )

        course_id = self.request.query_params.get("course")
        batch_id = self.request.query_params.get("batch")
        student_id = self.request.query_params.get("student")

        if course_id:
            queryset = queryset.filter(course_id=course_id)
        if batch_id:
            queryset = queryset.filter(course__batch_id=batch_id)
        if student_id:
            queryset = queryset.filter(student_id=student_id)

        return queryset


# ===============================================================
# Dropdown data for the Course / Enrollment / Allocation forms
# ===============================================================

class DropdownOptionsView(APIView):
    """
    GET /api/academic-manager/dropdowns/
    Returns the faculty and student lists used to populate every
    select box in the Batch/Course/Enrollment/Allocation pages, in
    one request rather than one call per dropdown. Deliberately NOT
    paginated — every dropdown needs the full set in one page, same
    reasoning as loadDropdownData() in admin-performance.js (a
    paginated dropdown that silently only shows 10 items is a bug,
    not a feature).
    """
    permission_classes = [IsAuthenticated, IsAcademicManager]

    def get(self, request):
        faculty = CustomUser.objects.filter(role="FACULTY").order_by("username")
        students = CustomUser.objects.filter(role="STUDENT").order_by("username")

        return Response({
            "faculty": DropdownUserSerializer(faculty, many=True).data,
            "students": DropdownUserSerializer(students, many=True).data,
        })


# ===============================================================
# Sprint 2, Day 1 — Syllabus Topic CRUD
# ===============================================================

class SyllabusTopicViewSet(viewsets.ModelViewSet):
    """
    GET    /api/academic-manager/syllabus-topics/       (optionally ?course=<id>&search=&ordering=&page=&limit=)
    POST   /api/academic-manager/syllabus-topics/
    GET    /api/academic-manager/syllabus-topics/{id}/
    PATCH  /api/academic-manager/syllabus-topics/{id}/
    DELETE /api/academic-manager/syllabus-topics/{id}/
    """
    serializer_class = SyllabusTopicSerializer
    permission_classes = [IsAuthenticated, IsAcademicManager]
    pagination_class = StandardResultsPagination
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["topic_name", "course__name", "course__code"]
    ordering_fields = ["session_number", "status"]

    def get_queryset(self):
        queryset = SyllabusTopic.objects.select_related("course").order_by("course_id", "session_number")
        course_id = self.request.query_params.get("course")
        if course_id:
            queryset = queryset.filter(course_id=course_id)
        return queryset


# ===============================================================
# Sprint 2, Day 2 — Announcement CRUD
# ===============================================================

class AnnouncementViewSet(viewsets.ModelViewSet):
    """
    GET    /api/academic-manager/announcements/         (optionally ?course=<id>&search=&ordering=&page=&limit=)
    POST   /api/academic-manager/announcements/
    GET    /api/academic-manager/announcements/{id}/
    PATCH  /api/academic-manager/announcements/{id}/
    DELETE /api/academic-manager/announcements/{id}/
    """
    serializer_class = AnnouncementSerializer
    permission_classes = [IsAuthenticated, IsAcademicManager]
    pagination_class = StandardResultsPagination
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["title", "message", "course__name", "course__code"]
    ordering_fields = ["created_at", "title"]

    def get_queryset(self):
        queryset = Announcement.objects.select_related("course").order_by("-created_at")
        course_id = self.request.query_params.get("course")
        if course_id:
            queryset = queryset.filter(course_id=course_id)
        return queryset


# ===============================================================
# Sprint 2, Day 4 — Academic Manager Dashboard Statistics
# Same aggregation-endpoint pattern as FacultyDashboardView /
# StudentDashboardView — single object, never paginated.
# ===============================================================

class AcademicManagerDashboardStatsView(APIView):
    """
    GET /api/academic-manager/dashboard/
    """
    permission_classes = [IsAuthenticated, IsAcademicManager]

    def get(self, request):
        data = {
            "total_courses": Course.objects.count(),
            "total_batches": Batch.objects.count(),
            "total_faculty": CustomUser.objects.filter(role="FACULTY").count(),
            "total_students": CustomUser.objects.filter(role="STUDENT").count(),
            "total_enrollments": StudentCourse.objects.count(),
            "pending_leave_requests": LeaveRequest.objects.filter(
                status="PENDING", applicant__role="FACULTY"
            ).count(),
        }
        serializer = AcademicManagerDashboardStatsSerializer(data)
        return Response(serializer.data)