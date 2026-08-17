from django.shortcuts import render

# Create your views here.
from datetime import date

from django.db.models import Avg

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from academics.models import StudentCourse
from accounts.permissions import IsStudent
from faculty.models import Assignment, Submission, Attendance, ExamMark

from .serializers import StudentDashboardSerializer


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

        # Pending assignments — assignments in enrolled courses that this
        # student hasn't submitted anything for yet.
        all_assignment_ids = set(
            Assignment.objects.filter(course_id__in=course_ids).values_list("id", flat=True)
        )
        submitted_assignment_ids = set(
            Submission.objects
            .filter(student=student, assignment__course_id__in=course_ids)
            .values_list("assignment_id", flat=True)
        )
        pending_assignments_count = len(all_assignment_ids - submitted_assignment_ids)

        # Attendance percentage for the current calendar month only,
        # across all enrolled courses — same "current month" reasoning
        # used on the Faculty dashboard.
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