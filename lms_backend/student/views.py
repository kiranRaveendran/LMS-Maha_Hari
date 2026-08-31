from datetime import date

from django.db.models import Avg

from rest_framework import mixins, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser

from academics.models import StudentCourse
from accounts.permissions import IsStudent
from faculty.models import Assignment, Submission, Attendance, ExamMark, LearningMaterial
from leave_management.models import LeaveRequest

from .serializers import (
    StudentDashboardSerializer,
    StudentLearningMaterialSerializer,
    StudentAssignmentSerializer,
    StudentSubmissionSerializer,
    StudentExamMarkSerializer,
    StudentAttendanceSerializer,
    StudentLeaveRequestSerializer,
)


# ===============================================================
# Stage 1 — Dashboard
# ===============================================================

class StudentDashboardView(APIView):
    """
    GET /api/student/dashboard/
    Scoped strictly to request.user — a student can only ever see
    their own courses/profile/summary through this endpoint.
    """
    permission_classes = [IsAuthenticated, IsStudent]

    def get(self, request):
        student = request.user

        enrollments = (
            StudentCourse.objects
            .filter(student=student)
            .select_related("course", "course__faculty", "course__batch")
        )
        courses = [e.course for e in enrollments]
        course_ids = [c.id for c in courses]

        total_courses = len(courses)

        all_assignment_ids = set(
            Assignment.objects.filter(course_id__in=course_ids).values_list("id", flat=True)
        )
        submitted_assignment_ids = set(
            Submission.objects
            .filter(student=student, assignment__course_id__in=course_ids)
            .values_list("assignment_id", flat=True)
        )
        pending_assignments_count = len(all_assignment_ids - submitted_assignment_ids)

        today = date.today()
        month_attendance = Attendance.objects.filter(
            student=student,
            course_id__in=course_ids,
            date__year=today.year,
            date__month=today.month
        )
        total_marked = month_attendance.count()
        total_present = month_attendance.filter(status="PRESENT").count()
        attendance_percentage = (
            round((total_present / total_marked) * 100, 1) if total_marked else None
        )

        avg_marks = ExamMark.objects.filter(
            student=student, course_id__in=course_ids
        ).aggregate(avg=Avg("marks"))["avg"]
        average_marks = round(float(avg_marks), 2) if avg_marks is not None else None

        data = {
            "profile": student,
            "courses": courses,
            "total_courses": total_courses,
            "pending_assignments_count": pending_assignments_count,
            "attendance_percentage_this_month": attendance_percentage,
            "average_marks": average_marks,
        }

        serializer = StudentDashboardSerializer(data)
        return Response(serializer.data)


# ===============================================================
# Stage 2 — Learning Materials (read-only)
# ===============================================================

class StudentLearningMaterialViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """
    Read-only — students see materials only for courses they're
    actually enrolled in, never another course's materials by
    guessing an ID.

    GET /api/student/learning-materials/                 (optionally ?course=<id>)
    GET /api/student/learning-materials/{id}/
    """
    serializer_class = StudentLearningMaterialSerializer
    permission_classes = [IsAuthenticated, IsStudent]

    def get_queryset(self):
        enrolled_course_ids = StudentCourse.objects.filter(
            student=self.request.user
        ).values_list("course_id", flat=True)

        queryset = (
            LearningMaterial.objects
            .filter(course_id__in=enrolled_course_ids)
            .select_related("course")
            .order_by("-uploaded_at")
        )

        course_id = self.request.query_params.get("course")
        if course_id:
            queryset = queryset.filter(course_id=course_id)

        return queryset


# ===============================================================
# Stage 3 — Assignments (read, with submission status) + Submission (create-only)
# ===============================================================

class StudentAssignmentViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """
    Read-only list of assignments for the student's enrolled courses,
    each annotated with this student's own submission status (or null
    if not submitted yet).

    GET /api/student/assignments/                 (optionally ?course=<id>)
    GET /api/student/assignments/{id}/
    """
    serializer_class = StudentAssignmentSerializer
    permission_classes = [IsAuthenticated, IsStudent]

    def get_queryset(self):
        enrolled_course_ids = StudentCourse.objects.filter(
            student=self.request.user
        ).values_list("course_id", flat=True)

        queryset = (
            Assignment.objects
            .filter(course_id__in=enrolled_course_ids)
            .select_related("course")
            .order_by("-due_date")
        )

        course_id = self.request.query_params.get("course")
        if course_id:
            queryset = queryset.filter(course_id=course_id)

        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context


class StudentSubmissionViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    """
    Create-only — a student submits their work for an assignment.
    One submission per assignment per student, no resubmission
    (Submission.submitted_at is auto_now_add, so a resubmit would
    silently keep the original timestamp — rather than build
    something fragile around that, submitting twice is just rejected).

    POST /api/student/submissions/   (multipart: assignment, file)
    """
    serializer_class = StudentSubmissionSerializer
    permission_classes = [IsAuthenticated, IsStudent]
    parser_classes = [MultiPartParser, FormParser]

    def create(self, request, *args, **kwargs):

        assignment_id = request.data.get("assignment")
        file = request.FILES.get("file")

        if not assignment_id or not file:
            return Response({"detail": "assignment and file are required."}, status=400)

        try:
            assignment = Assignment.objects.get(id=assignment_id)
        except Assignment.DoesNotExist:
            return Response({"detail": "Assignment not found."}, status=404)

        is_enrolled = StudentCourse.objects.filter(
            student=request.user, course=assignment.course
        ).exists()
        if not is_enrolled:
            return Response({"detail": "You are not enrolled in this course."}, status=403)

        if Submission.objects.filter(assignment=assignment, student=request.user).exists():
            return Response({"detail": "You have already submitted this assignment."}, status=400)

        submission = Submission.objects.create(
            assignment=assignment, student=request.user, file=file
        )

        serializer = StudentSubmissionSerializer(submission, context={"request": request})
        return Response(serializer.data, status=201)


# ===============================================================
# Stage 4 — Exam Marks (read-only)
# ===============================================================

class StudentExamMarkViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """
    Read-only — exam results (INTERNAL / MODEL / FINAL) entered by
    faculty via faculty.ExamMarkViewSet. Same model, own records only,
    scoped to courses the student is actually enrolled in.

    GET /api/student/exam-marks/                 (optionally ?course=<id>&exam_type=<type>)
    GET /api/student/exam-marks/{id}/
    """
    serializer_class = StudentExamMarkSerializer
    permission_classes = [IsAuthenticated, IsStudent]

    def get_queryset(self):
        enrolled_course_ids = StudentCourse.objects.filter(
            student=self.request.user
        ).values_list("course_id", flat=True)

        queryset = (
            ExamMark.objects
            .filter(student=self.request.user, course_id__in=enrolled_course_ids)
            .select_related("course")
            .order_by("course__name", "exam_type")
        )

        course_id = self.request.query_params.get("course")
        exam_type = self.request.query_params.get("exam_type")

        if course_id:
            queryset = queryset.filter(course_id=course_id)
        if exam_type:
            queryset = queryset.filter(exam_type=exam_type)

        return queryset


# ===============================================================
# Stage 5 — Attendance (read-only)
# ===============================================================

class StudentAttendanceViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """
    Read-only — a student's own attendance records, marked by faculty
    via faculty.AttendanceViewSet (roster/bulk-mark). No write actions
    here at all; a student can view the calendar but never edit it.

    GET /api/student/attendance/                 (optionally ?course=<id>)
    GET /api/student/attendance/{id}/
    """
    serializer_class = StudentAttendanceSerializer
    permission_classes = [IsAuthenticated, IsStudent]

    def get_queryset(self):
        enrolled_course_ids = StudentCourse.objects.filter(
            student=self.request.user
        ).values_list("course_id", flat=True)

        queryset = (
            Attendance.objects
            .filter(student=self.request.user, course_id__in=enrolled_course_ids)
            .select_related("course")
            .order_by("-date")
        )

        course_id = self.request.query_params.get("course")
        if course_id:
            queryset = queryset.filter(course_id=course_id)

        return queryset


# ===============================================================
# Stage 6 — Leave Requests (submit + view own history + withdraw)
# ===============================================================

class StudentLeaveHistoryViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin,
    mixins.CreateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet
):
    """
    Mirrors faculty.FacultyLeaveHistoryViewSet exactly: students view
    their own leave history, submit new requests, and can withdraw
    (delete) a request only while it's still PENDING — once faculty
    reviews it (via faculty.StudentLeaveRequestViewSet), it becomes a
    permanent record and can't be deleted.

    GET    /api/student/leave-history/
    GET    /api/student/leave-history/{id}/
    POST   /api/student/leave-history/
    DELETE /api/student/leave-history/{id}/   (PENDING only)
    """
    serializer_class = StudentLeaveRequestSerializer
    permission_classes = [IsAuthenticated, IsStudent]

    def get_queryset(self):
        return (
            LeaveRequest.objects
            .filter(applicant=self.request.user)
            .select_related("reviewed_by")
            .order_by("-applied_at")
        )

    def perform_create(self, serializer):
        # status/reviewed_by are deliberately not client-settable — every
        # new request starts PENDING with no reviewer, same guarantee as
        # the Faculty side.
        serializer.save(applicant=self.request.user, status="PENDING", reviewed_by=None)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status != "PENDING":
            return Response(
                {"detail": "Only pending requests can be withdrawn. This request has already been reviewed."},
                status=400
            )
        return super().destroy(request, *args, **kwargs)