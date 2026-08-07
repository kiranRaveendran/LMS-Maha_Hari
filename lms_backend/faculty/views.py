from datetime import date

from django.db.models import Avg

from rest_framework import viewsets, mixins
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.decorators import action

from academics.models import Course, StudentCourse
from accounts.permissions import IsFaculty
from leave_management.models import LeaveRequest

from .models import (
    LearningMaterial, Assignment, Submission, Attendance, ExamMark
)
from .serializers import (
    FacultyDashboardSerializer,
    LearningMaterialSerializer,
    AssignmentSerializer,
    SubmissionSerializer, SubmissionGradeSerializer,
    AttendanceSerializer,
    ExamMarkSerializer,
    FacultyLeaveRequestSerializer,
    StudentLeaveRequestSerializer, StudentLeaveReviewSerializer,
)


# ===============================================================
# Stage 1 + 8 — Dashboard
# ===============================================================

class FacultyDashboardView(APIView):
    """
    GET /api/faculty/dashboard/
    Scoped strictly to request.user — a faculty member can only
    ever see their own courses/profile/summary through this endpoint,
    never another faculty member's.
    """
    permission_classes = [IsAuthenticated, IsFaculty]

    def get(self, request):
        faculty_user = request.user
        courses = Course.objects.filter(faculty=faculty_user)

        total_students = (
            courses.values("studentcourse__student").distinct().count()
        )

        # Small N per faculty (a handful of courses), so looping here
        # is fine. Worth aggregating in one query later if a faculty
        # member ever teaches dozens of courses.
        total_assignments = sum(c.assignments.count() for c in courses)
        total_learning_materials = sum(c.learning_materials.count() for c in courses)

        # Pending grading — submissions not yet graded, across all this
        # faculty member's courses. This is what "pending assignment
        # count" means in practice: work waiting on the faculty member.
        pending_grading_count = Submission.objects.filter(
            assignment__course__faculty=faculty_user,
            grade__isnull=True
        ).count()

        # Per-course breakdown, not a single blended number — a merged
        # "82% attendance across everything" is meaningless once a faculty
        # member teaches more than one course with different patterns.
        today = date.today()
        course_breakdown = []

        for course in courses:

            month_attendance = Attendance.objects.filter(
                course=course,
                date__year=today.year,
                date__month=today.month
            )
            total_marked = month_attendance.count()
            total_present = month_attendance.filter(status="PRESENT").count()
            attendance_percentage = (
                round((total_present / total_marked) * 100, 1) if total_marked else None
            )

            avg_marks = ExamMark.objects.filter(course=course).aggregate(
                avg=Avg("marks")
            )["avg"]
            average_marks = round(float(avg_marks), 2) if avg_marks is not None else None

            course_breakdown.append({
                "course_id": course.id,
                "course_name": course.name,
                "course_code": course.code,
                "attendance_percentage_this_month": attendance_percentage,
                "average_marks": average_marks,
            })

        data = {
            "profile": faculty_user,
            "courses": courses,
            "total_courses": courses.count(),
            "total_students": total_students,
            "total_assignments": total_assignments,
            "total_learning_materials": total_learning_materials,
            "pending_grading_count": pending_grading_count,
            "course_breakdown": course_breakdown,
        }

        serializer = FacultyDashboardSerializer(data)
        return Response(serializer.data)


# ===============================================================
# Stage 2 — Learning Materials
# ===============================================================

class LearningMaterialViewSet(viewsets.ModelViewSet):
    """
    Full CRUD for Learning Materials, scoped strictly to the logged-in
    faculty member's own courses — they can never see or touch another
    faculty member's materials, even by guessing an ID.

    GET    /api/faculty/learning-materials/
    POST   /api/faculty/learning-materials/
    GET    /api/faculty/learning-materials/{id}/
    PATCH  /api/faculty/learning-materials/{id}/
    DELETE /api/faculty/learning-materials/{id}/
    """
    serializer_class = LearningMaterialSerializer
    permission_classes = [IsAuthenticated, IsFaculty]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        return (
            LearningMaterial.objects
            .filter(course__faculty=self.request.user)
            .order_by("-uploaded_at")
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context


# ===============================================================
# Stage 3 — Assignments
# ===============================================================

class AssignmentViewSet(viewsets.ModelViewSet):
    """
    Full CRUD for Assignments, scoped to the logged-in faculty
    member's own courses only.

    GET    /api/faculty/assignments/
    POST   /api/faculty/assignments/
    GET    /api/faculty/assignments/{id}/
    PATCH  /api/faculty/assignments/{id}/
    DELETE /api/faculty/assignments/{id}/
    """
    serializer_class = AssignmentSerializer
    permission_classes = [IsAuthenticated, IsFaculty]

    def get_queryset(self):
        return (
            Assignment.objects
            .filter(course__faculty=self.request.user)
            .order_by("-due_date")
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context


# ===============================================================
# Stage 4 — Submission Review & Grading
# ===============================================================

class SubmissionViewSet(viewsets.ModelViewSet):
    """
    Review + grade submissions, scoped to the logged-in faculty
    member's own courses. No create/delete — students submit,
    faculty only review and grade.

    GET   /api/faculty/submissions/              (optionally ?assignment=<id>)
    GET   /api/faculty/submissions/{id}/
    PATCH /api/faculty/submissions/{id}/          (grade + feedback only)
    """
    permission_classes = [IsAuthenticated, IsFaculty]
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        queryset = (
            Submission.objects
            .filter(assignment__course__faculty=self.request.user)
            .select_related("assignment", "student")
            .order_by("-submitted_at")
        )

        assignment_id = self.request.query_params.get("assignment")
        if assignment_id:
            queryset = queryset.filter(assignment_id=assignment_id)

        return queryset

    def get_serializer_class(self):
        if self.action == "partial_update":
            return SubmissionGradeSerializer
        return SubmissionSerializer


# ===============================================================
# Stage 5 — Attendance
# ===============================================================

class AttendanceViewSet(viewsets.ModelViewSet):
    """
    GET    /api/faculty/attendance/                    (optionally ?course=<id>&date=<YYYY-MM-DD>)
    GET    /api/faculty/attendance/roster/?course=<id>&date=<YYYY-MM-DD>
    POST   /api/faculty/attendance/bulk-mark/
    PATCH  /api/faculty/attendance/{id}/
    DELETE /api/faculty/attendance/{id}/
    """
    serializer_class = AttendanceSerializer
    permission_classes = [IsAuthenticated, IsFaculty]

    def get_queryset(self):
        queryset = (
            Attendance.objects
            .filter(course__faculty=self.request.user)
            .select_related("student", "course")
            .order_by("-date")
        )

        course_id = self.request.query_params.get("course")
        date_param = self.request.query_params.get("date")

        if course_id:
            queryset = queryset.filter(course_id=course_id)
        if date_param:
            queryset = queryset.filter(date=date_param)

        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    @action(detail=False, methods=["get"], url_path="roster")
    def roster(self, request):
        """
        Every student enrolled in the course, with their existing status
        for that date if already marked, or null if not marked yet.
        This is what the marking interface renders.
        """
        course_id = request.query_params.get("course")
        date_param = request.query_params.get("date")

        if not course_id or not date_param:
            return Response({"detail": "course and date are required."}, status=400)

        enrollments = (
            StudentCourse.objects
            .filter(course_id=course_id, course__faculty=request.user)
            .select_related("student")
        )

        existing = {
            a.student_id: a
            for a in Attendance.objects.filter(course_id=course_id, date=date_param)
        }

        data = [
            {
                "student": e.student.id,
                "student_username": e.student.username,
                "attendance_id": existing[e.student.id].id if e.student.id in existing else None,
                "status": existing[e.student.id].status if e.student.id in existing else None,
            }
            for e in enrollments
        ]

        return Response(data)

    @action(detail=False, methods=["post"], url_path="bulk-mark")
    def bulk_mark(self, request):
        """
        Body: { "course": <id>, "date": "YYYY-MM-DD", "records": [{"student": <id>, "status": "PRESENT"}, ...] }
        Creates or updates attendance for every student in one request.
        """
        course_id = request.data.get("course")
        date_param = request.data.get("date")
        records = request.data.get("records", [])

        try:
            course = Course.objects.get(id=course_id, faculty=request.user)
        except Course.DoesNotExist:
            return Response({"detail": "Invalid course."}, status=400)

        saved = []
        for record in records:
            attendance, _ = Attendance.objects.update_or_create(
                course=course,
                student_id=record["student"],
                date=date_param,
                defaults={"status": record["status"]},
            )
            saved.append(attendance.id)

        return Response({"saved": saved}, status=200)


# ===============================================================
# Stage 6 — Exam Marks
# ===============================================================

class ExamMarkViewSet(viewsets.ModelViewSet):
    """
    GET    /api/faculty/exam-marks/                         (optionally ?course=<id>&exam_type=<type>)
    GET    /api/faculty/exam-marks/roster/?course=<id>&exam_type=<type>
    POST   /api/faculty/exam-marks/bulk-save/
    PATCH  /api/faculty/exam-marks/{id}/
    DELETE /api/faculty/exam-marks/{id}/
    """
    serializer_class = ExamMarkSerializer
    permission_classes = [IsAuthenticated, IsFaculty]

    def get_queryset(self):
        queryset = (
            ExamMark.objects
            .filter(course__faculty=self.request.user)
            .select_related("student", "course")
            .order_by("student__username")
        )

        course_id = self.request.query_params.get("course")
        exam_type = self.request.query_params.get("exam_type")

        if course_id:
            queryset = queryset.filter(course_id=course_id)
        if exam_type:
            queryset = queryset.filter(exam_type=exam_type)

        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    @action(detail=False, methods=["get"], url_path="roster")
    def roster(self, request):
        course_id = request.query_params.get("course")
        exam_type = request.query_params.get("exam_type")

        if not course_id or not exam_type:
            return Response({"detail": "course and exam_type are required."}, status=400)

        enrollments = (
            StudentCourse.objects
            .filter(course_id=course_id, course__faculty=request.user)
            .select_related("student")
        )

        existing = {
            m.student_id: m
            for m in ExamMark.objects.filter(course_id=course_id, exam_type=exam_type)
        }

        data = [
            {
                "student": e.student.id,
                "student_username": e.student.username,
                "mark_id": existing[e.student.id].id if e.student.id in existing else None,
                "marks": existing[e.student.id].marks if e.student.id in existing else None,
            }
            for e in enrollments
        ]

        return Response(data)

    @action(detail=False, methods=["post"], url_path="bulk-save")
    def bulk_save(self, request):
        course_id = request.data.get("course")
        exam_type = request.data.get("exam_type")
        records = request.data.get("records", [])

        try:
            course = Course.objects.get(id=course_id, faculty=request.user)
        except Course.DoesNotExist:
            return Response({"detail": "Invalid course."}, status=400)

        saved = []
        for record in records:
            mark, _ = ExamMark.objects.update_or_create(
                course=course,
                student_id=record["student"],
                exam_type=exam_type,
                defaults={"marks": record["marks"]},
            )
            saved.append(mark.id)

        return Response({"saved": saved}, status=200)


# ===============================================================
# Stage 7 — Faculty Leave (view own history + submit own requests)
# ===============================================================

class FacultyLeaveHistoryViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin,
    mixins.CreateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet
):
    """
    Faculty view their own leave history, submit new leave requests,
    and withdraw (delete) a request only while it's still PENDING —
    once reviewed, it becomes a permanent record and can't be deleted.

    GET    /api/faculty/leave-history/
    GET    /api/faculty/leave-history/{id}/
    POST   /api/faculty/leave-history/
    DELETE /api/faculty/leave-history/{id}/   (PENDING only)
    """
    serializer_class = FacultyLeaveRequestSerializer
    permission_classes = [IsAuthenticated, IsFaculty]

    def get_queryset(self):
        return (
            LeaveRequest.objects
            .filter(applicant=self.request.user)
            .select_related("reviewed_by")
            .order_by("-applied_at")
        )

    def perform_create(self, serializer):
        # status/reviewed_by are deliberately not client-settable — every
        # new request starts PENDING with no reviewer, regardless of what
        # the request body contains (the serializer already locks status
        # read-only, this is a second, redundant guarantee at the view level).
        serializer.save(applicant=self.request.user, status="PENDING", reviewed_by=None)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status != "PENDING":
            return Response(
                {"detail": "Only pending requests can be withdrawn. This request has already been reviewed."},
                status=400
            )
        return super().destroy(request, *args, **kwargs)


# ===============================================================
# Student Leave Approval — faculty review requests from their own students
# ===============================================================

class StudentLeaveRequestViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet
):
    """
    Faculty view + approve/reject leave requests submitted by students
    enrolled in any of their courses. A student enrolled in courses
    taught by multiple faculty members can have their request actioned
    by any one of them — there's no single "assigned" approver per
    student in the current data model.

    Delete is only allowed on already-decided requests (cleanup of old
    records) — a PENDING request must go through Approve/Reject first,
    it can't be deleted to dodge making a decision.

    GET    /api/faculty/student-leave-requests/              (optionally ?status=PENDING)
    GET    /api/faculty/student-leave-requests/{id}/
    PATCH  /api/faculty/student-leave-requests/{id}/          (status only)
    DELETE /api/faculty/student-leave-requests/{id}/          (non-PENDING only)
    """
    permission_classes = [IsAuthenticated, IsFaculty]
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_queryset(self):
        student_ids = (
            StudentCourse.objects
            .filter(course__faculty=self.request.user)
            .values_list("student_id", flat=True)
            .distinct()
        )

        queryset = (
            LeaveRequest.objects
            .filter(applicant_id__in=student_ids, applicant__role="STUDENT")
            .select_related("applicant")
            .order_by("-applied_at")
        )

        status_param = self.request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status=status_param)

        return queryset

    def get_serializer_class(self):
        if self.action == "partial_update":
            return StudentLeaveReviewSerializer
        return StudentLeaveRequestSerializer

    def perform_update(self, serializer):
        serializer.save(reviewed_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status == "PENDING":
            return Response(
                {"detail": "Pending requests must be approved or rejected, not deleted."},
                status=400
            )
        return super().destroy(request, *args, **kwargs)