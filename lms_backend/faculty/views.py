from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from academics.models import Course
from accounts.permissions import IsFaculty
from .serializers import FacultyDashboardSerializer


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

        data = {
            "profile": faculty_user,
            "courses": courses,
            "total_courses": courses.count(),
            "total_students": total_students,
            "total_assignments": total_assignments,
            "total_learning_materials": total_learning_materials,
        }

        serializer = FacultyDashboardSerializer(data)
        return Response(serializer.data)
    

from rest_framework import viewsets
from rest_framework.parsers import MultiPartParser, FormParser

from .models import LearningMaterial
from .serializers import LearningMaterialSerializer


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
    
from .models import Assignment
from .serializers import AssignmentSerializer


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