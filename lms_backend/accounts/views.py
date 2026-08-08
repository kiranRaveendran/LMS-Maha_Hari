from django.contrib.auth import get_user_model
from django.db.models import Count, Q, Avg
from django.shortcuts import render

from academics.models import Course, Batch, StudentCourse
from leave_management.models import LeaveRequest
from faculty.models import Attendance, ExamMark

from rest_framework import status, generics, viewsets, mixins
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

from .jwt_serializers import CustomTokenObtainPairSerializer
from .serializers import UserSerializer
from .models import CustomUser
from .permissions import (
    IsSuperUser,
    IsAcademicManager,
    IsFaculty,
    IsStudent,
)
from .admin_serializers import (
    DashboardStatsSerializer,
    AcademicManagerSerializer,
    FacultySerializer,
    StudentSerializer,
    AdminCourseSerializer,
    AdminLeaveRequestSerializer, AdminLeaveReviewSerializer,
    AdminCoursePerformanceSerializer,
    AdminBatchPerformanceSerializer,
    AdminBatchCourseSummarySerializer,
)
from .pagination import StandardResultsPagination

User = get_user_model()


# ===============================================================
# Authentication
# ===============================================================

class CustomTokenObtainPairView(TokenObtainPairView):

    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):

        serializer = self.get_serializer(data=request.data)

        try:
            serializer.is_valid(raise_exception=True)

            return Response(
                {
                    "status": 200,
                    "message": "Login successful.",
                    "data": serializer.validated_data,
                },
                status=status.HTTP_200_OK,
            )

        except AuthenticationFailed:

            return Response(
                {
                    "status": 401,
                    "message": "Invalid username or password.",
                    "errors": {
                        "detail": "No active account found with the given credentials."
                    }
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )


# ===============================================================
# Legacy Django-template render views
# (pre-date the frontend/backend split — kept as-is, not part of
# the JSON API. Worth a cleanup pass later if genuinely unused.)
# ===============================================================

def login_page(request):
    return render(request, "login.html")


def admin_dashboard(request):
    return render(request, "admin_dashboard.html")


def academic_manager_dashboard(request):
    return render(request, "academic_manager_dashboard.html")


def faculty_dashboard(request):
    return render(request, "faculty_dashboard.html")


def student_dashboard(request):
    return render(request, "student_dashboard.html")


def academic_manager_management(request):
    return render(request, "admin/academic_manager_list.html")


def faculty_management(request):
    return render(request, "admin/faculty_list.html")


def student_management(request):
    return render(request, "admin/student_list.html")


# ===============================================================
# Profile + role-check endpoints
# ===============================================================

class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


class AdminOnlyView(APIView):
    permission_classes = [IsSuperUser]

    def get(self, request):
        return Response({"message": "Welcome Admin"})


class AcademicManagerView(APIView):
    permission_classes = [IsAcademicManager]

    def get(self, request):
        return Response({"message": "Welcome Academic Manager"})


class FacultyView(APIView):
    permission_classes = [IsFaculty]

    def get(self, request):
        return Response({"message": "Welcome Faculty"})


class StudentView(APIView):
    permission_classes = [IsStudent]

    def get(self, request):
        return Response({"message": "Welcome Student"})


# ===============================================================
# Academic Manager / Faculty / Student CRUD (Admin-managed accounts)
# ===============================================================

class AcademicManagerListCreateView(generics.ListCreateAPIView):
    serializer_class = AcademicManagerSerializer
    permission_classes = [IsSuperUser]
    pagination_class = StandardResultsPagination
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["username", "email", "phone"]
    ordering_fields = ["username", "email", "date_joined"]
    ordering = ["-date_joined"]

    def get_queryset(self):
        return CustomUser.objects.filter(role=CustomUser.Role.ACADEMIC_MANAGER)


class AcademicManagerDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AcademicManagerSerializer
    permission_classes = [IsSuperUser]

    def get_queryset(self):
        return CustomUser.objects.filter(role=CustomUser.Role.ACADEMIC_MANAGER)


class FacultyListCreateView(generics.ListCreateAPIView):
    serializer_class = FacultySerializer
    permission_classes = [IsSuperUser]
    pagination_class = StandardResultsPagination
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["username", "email", "phone"]
    ordering_fields = ["username", "email", "date_joined"]
    ordering = ["-date_joined"]

    def get_queryset(self):
        return CustomUser.objects.filter(role=CustomUser.Role.FACULTY)


class FacultyDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = FacultySerializer
    permission_classes = [IsSuperUser]

    def get_queryset(self):
        return CustomUser.objects.filter(role=CustomUser.Role.FACULTY)


class StudentListCreateView(generics.ListCreateAPIView):
    serializer_class = StudentSerializer
    permission_classes = [IsSuperUser]
    pagination_class = StandardResultsPagination
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["username", "email", "phone"]
    ordering_fields = ["username", "email", "date_joined"]
    ordering = ["-date_joined"]

    def get_queryset(self):
        return CustomUser.objects.filter(role=CustomUser.Role.STUDENT)


class StudentDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = StudentSerializer
    permission_classes = [IsSuperUser]

    def get_queryset(self):
        return CustomUser.objects.filter(role=CustomUser.Role.STUDENT)


# ===============================================================
# Admin Dashboard Statistics
# ===============================================================

class AdminDashboardStatsView(APIView):
    """
    Single aggregated endpoint for the admin dashboard cards.
    GET /api/accounts/admin/dashboard/
    """
    permission_classes = [IsAuthenticated, IsSuperUser]

    def get(self, request):
        user_counts = User.objects.aggregate(
            total_students=Count("id", filter=Q(role="STUDENT")),
            total_faculty=Count("id", filter=Q(role="FACULTY")),
            total_academic_managers=Count("id", filter=Q(role="ACADEMIC_MANAGER")),
        )

        total_courses = Course.objects.count()
        pending_leave_requests = LeaveRequest.objects.filter(status="PENDING").count()

        data = {
            **user_counts,
            "total_courses": total_courses,
            "pending_leave_requests": pending_leave_requests,
        }

        serializer = DashboardStatsSerializer(data)
        return Response(serializer.data)


# ===============================================================
# Admin Course Oversight (read-only)
# ===============================================================

class AdminCourseListView(generics.ListAPIView):
    """
    Read-only course oversight for Admin — no create/edit/delete,
    that's Academic Manager's job (Developer 2's module).
    GET /api/accounts/admin/courses/?page=<n>&limit=<n>&search=<text>
    """
    permission_classes = [IsAuthenticated, IsSuperUser]
    serializer_class = AdminCourseSerializer
    pagination_class = StandardResultsPagination
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["name", "code", "faculty__username"]
    ordering_fields = ["name", "code"]
    ordering = ["code"]
    queryset = Course.objects.select_related("faculty", "batch").all()


# ===============================================================
# Admin Leave Requests — Academic Manager requests only
# ===============================================================

class AdminLeaveRequestViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """
    Admin view + approve/reject leave requests from Academic Managers
    specifically — not Faculty or Student requests, those are reviewed
    by Academic Manager and Faculty respectively, one level down.

    GET   /api/accounts/admin/leave-requests/            (optionally ?status=PENDING&page=<n>&limit=<n>)
    GET   /api/accounts/admin/leave-requests/{id}/
    PATCH /api/accounts/admin/leave-requests/{id}/        (status only)
    """
    permission_classes = [IsAuthenticated, IsSuperUser]
    http_method_names = ["get", "patch", "head", "options"]
    pagination_class = StandardResultsPagination

    def get_queryset(self):
        queryset = (
            LeaveRequest.objects
            .filter(applicant__role="ACADEMIC_MANAGER")
            .select_related("applicant", "reviewed_by")
            .order_by("-applied_at")
        )
        status_param = self.request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param)
        return queryset

    def get_serializer_class(self):
        if self.action == "partial_update":
            return AdminLeaveReviewSerializer
        return AdminLeaveRequestSerializer

    def perform_update(self, serializer):
        serializer.save(reviewed_by=self.request.user)


# ===============================================================
# Admin Student Performance Analysis
# ===============================================================

class AdminCoursePerformanceView(APIView):
    """
    GET /api/accounts/admin/course-performance/?course=<id>
    Per-student attendance % and average marks for one course,
    plus class-wide averages.
    """
    permission_classes = [IsAuthenticated, IsSuperUser]

    def get(self, request):
        course_id = request.query_params.get("course")
        if not course_id:
            return Response({"detail": "course is required."}, status=400)

        try:
            course = Course.objects.select_related("faculty").get(id=course_id)
        except Course.DoesNotExist:
            return Response({"detail": "Course not found."}, status=404)

        enrollments = StudentCourse.objects.filter(course=course).select_related("student")

        students_data = []
        for enrollment in enrollments:
            student = enrollment.student

            attendance_qs = Attendance.objects.filter(course=course, student=student)
            total_marked = attendance_qs.count()
            total_present = attendance_qs.filter(status="PRESENT").count()
            attendance_pct = round((total_present / total_marked) * 100, 1) if total_marked else None

            avg = ExamMark.objects.filter(course=course, student=student).aggregate(avg=Avg("marks"))["avg"]
            avg_marks = round(float(avg), 2) if avg is not None else None

            students_data.append({
                "student_id": student.id,
                "username": student.username,
                "attendance_percentage": attendance_pct,
                "average_marks": avg_marks,
            })

        course_attendance = Attendance.objects.filter(course=course)
        course_total_marked = course_attendance.count()
        course_total_present = course_attendance.filter(status="PRESENT").count()
        class_avg_attendance = round((course_total_present / course_total_marked) * 100, 1) if course_total_marked else None

        course_avg = ExamMark.objects.filter(course=course).aggregate(avg=Avg("marks"))["avg"]
        class_avg_marks = round(float(course_avg), 2) if course_avg is not None else None

        data = {
            "course_id": course.id,
            "course_name": course.name,
            "course_code": course.code,
            "faculty_username": course.faculty.username if course.faculty else None,
            "class_average_attendance": class_avg_attendance,
            "class_average_marks": class_avg_marks,
            "students": students_data,
        }

        serializer = AdminCoursePerformanceSerializer(data)
        return Response(serializer.data)


class AdminBatchPerformanceView(APIView):
    """
    GET /api/accounts/admin/batch-performance/?batch=<id>
    Rolls up every course under a batch — one row per course with
    that course's class averages, plus an overall batch-wide average.
    """
    permission_classes = [IsAuthenticated, IsSuperUser]

    def get(self, request):
        batch_id = request.query_params.get("batch")
        if not batch_id:
            return Response({"detail": "batch is required."}, status=400)

        try:
            batch = Batch.objects.get(id=batch_id)
        except Batch.DoesNotExist:
            return Response({"detail": "Batch not found."}, status=404)

        courses = Course.objects.filter(batch=batch)

        courses_data = []
        total_marked_all = 0
        total_present_all = 0
        all_marks_values = []

        for course in courses:
            attendance_qs = Attendance.objects.filter(course=course)
            total_marked = attendance_qs.count()
            total_present = attendance_qs.filter(status="PRESENT").count()
            course_att_pct = round((total_present / total_marked) * 100, 1) if total_marked else None

            total_marked_all += total_marked
            total_present_all += total_present

            marks_qs = ExamMark.objects.filter(course=course)
            avg = marks_qs.aggregate(avg=Avg("marks"))["avg"]
            course_avg_marks = round(float(avg), 2) if avg is not None else None
            all_marks_values.extend(marks_qs.values_list("marks", flat=True))

            courses_data.append({
                "course_id": course.id,
                "course_name": course.name,
                "course_code": course.code,
                "class_average_attendance": course_att_pct,
                "class_average_marks": course_avg_marks,
            })

        overall_attendance = round((total_present_all / total_marked_all) * 100, 1) if total_marked_all else None
        overall_marks = round(float(sum(all_marks_values) / len(all_marks_values)), 2) if all_marks_values else None

        data = {
            "batch_id": batch.id,
            "batch_name": batch.name,
            "overall_average_attendance": overall_attendance,
            "overall_average_marks": overall_marks,
            "courses": courses_data,
        }

        serializer = AdminBatchPerformanceSerializer(data)
        return Response(serializer.data)


class AdminAllCoursesPerformanceView(APIView):
    """
    GET /api/accounts/admin/courses-performance/
    Class-wide attendance % and average marks for every course, in one
    call — used for the Admin Dashboard's Performance Overview widget,
    so the dashboard doesn't need to fire one request per course.
    """
    permission_classes = [IsAuthenticated, IsSuperUser]

    def get(self, request):
        courses = Course.objects.select_related("faculty").all().order_by("code")

        data = []
        for course in courses:
            attendance_qs = Attendance.objects.filter(course=course)
            total_marked = attendance_qs.count()
            total_present = attendance_qs.filter(status="PRESENT").count()
            att_pct = round((total_present / total_marked) * 100, 1) if total_marked else None

            avg = ExamMark.objects.filter(course=course).aggregate(avg=Avg("marks"))["avg"]
            avg_marks = round(float(avg), 2) if avg is not None else None

            data.append({
                "course_id": course.id,
                "course_name": course.name,
                "course_code": course.code,
                "class_average_attendance": att_pct,
                "class_average_marks": avg_marks,
            })

        serializer = AdminBatchCourseSummarySerializer(data, many=True)
        return Response(serializer.data)