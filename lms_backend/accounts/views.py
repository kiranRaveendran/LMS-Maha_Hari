from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from academics.models import Course
from leave_management.models import LeaveRequest
from .admin_serializers import DashboardStatsSerializer

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import render
from rest_framework_simplejwt.views import TokenObtainPairView

from rest_framework import status
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

from .jwt_serializers import CustomTokenObtainPairSerializer
from .serializers import UserSerializer
from .permissions import (
    IsSuperUser,
    IsAcademicManager,
    IsFaculty,
    IsStudent,
)
from rest_framework import generics

from .admin_serializers import (
    AcademicManagerSerializer,
    FacultySerializer,
    StudentSerializer,
)
from .permissions import IsSuperUser
from .models import CustomUser

from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.exceptions import AuthenticationFailed
User = get_user_model()


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
    
class AcademicManagerListCreateView(generics.ListCreateAPIView):
    serializer_class = AcademicManagerSerializer
    permission_classes = [IsSuperUser]

    def get_queryset(self):
        return CustomUser.objects.filter(
            role=CustomUser.Role.ACADEMIC_MANAGER
        )


class AcademicManagerDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AcademicManagerSerializer
    permission_classes = [IsSuperUser]

    def get_queryset(self):
        return CustomUser.objects.filter(
            role=CustomUser.Role.ACADEMIC_MANAGER
        )
    
class FacultyListCreateView(generics.ListCreateAPIView):
    serializer_class = FacultySerializer
    permission_classes = [IsSuperUser]

    def get_queryset(self):
        return CustomUser.objects.filter(
            role=CustomUser.Role.FACULTY
        )


class FacultyDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = FacultySerializer
    permission_classes = [IsSuperUser]

    def get_queryset(self):
        return CustomUser.objects.filter(
            role=CustomUser.Role.FACULTY
        )
    
class StudentListCreateView(generics.ListCreateAPIView):
    serializer_class = StudentSerializer
    permission_classes = [IsSuperUser]

    def get_queryset(self):
        return CustomUser.objects.filter(
            role=CustomUser.Role.STUDENT
        )


class StudentDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = StudentSerializer
    permission_classes = [IsSuperUser]

    def get_queryset(self):
        return CustomUser.objects.filter(
            role=CustomUser.Role.STUDENT
        )
    
def academic_manager_management(request):
    return render(
        request,
        "admin/academic_manager_list.html"
    )

def faculty_management(request):
    return render(
        request,
        "admin/faculty_list.html"
    )

def student_management(request):
    return render(
        request,
        "admin/student_list.html"
    )

#new

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