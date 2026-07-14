from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import AdminDashboardStatsView

from .views import (
    CustomTokenObtainPairView,
    ProfileView,
    AdminOnlyView,
    AcademicManagerView,
    FacultyView,
    StudentView,

    AcademicManagerListCreateView,
    AcademicManagerDetailView,

    FacultyListCreateView,
    FacultyDetailView,

    StudentListCreateView,
    StudentDetailView,

    login_page,

    admin_dashboard,
    academic_manager_dashboard,
    faculty_dashboard,
    student_dashboard,

    academic_manager_management,
    faculty_management,
    student_management,
)

urlpatterns = [

    # ---------------- Authentication ---------------- #

    path(
        "",
        login_page,
        name="login-page"
    ),

    path(
        "login/",
        CustomTokenObtainPairView.as_view(),
        name="login"
    ),

    path(
        "refresh/",
        TokenRefreshView.as_view(),
        name="refresh"
    ),

    path(
        "profile/",
        ProfileView.as_view(),
        name="profile"
    ),

    # ---------------- Role APIs ---------------- #

    path(
        "admin/",
        AdminOnlyView.as_view(),
        name="admin-api"
    ),

    path(
        "academic-manager/",
        AcademicManagerView.as_view(),
        name="academic-manager-api"
    ),

    path(
        "faculty/",
        FacultyView.as_view(),
        name="faculty-api"
    ),

    path(
        "student/",
        StudentView.as_view(),
        name="student-api"
    ),

    # ---------------- Academic Manager CRUD ---------------- #

    path(
        "academic-managers/",
        AcademicManagerListCreateView.as_view(),
        name="academic-manager-list"
    ),

    path(
        "academic-managers/<int:pk>/",
        AcademicManagerDetailView.as_view(),
        name="academic-manager-detail"
    ),


    # ---------------- Faculty CRUD ---------------- #

path(
    "faculties/",
    FacultyListCreateView.as_view(),
    name="faculty-list"
),

path(
    "faculties/<int:pk>/",
    FacultyDetailView.as_view(),
    name="faculty-detail"
),


# ---------------- Student CRUD ---------------- #

path(
    "students/",
    StudentListCreateView.as_view(),
    name="student-list"
),

path(
    "students/<int:pk>/",
    StudentDetailView.as_view(),
    name="student-detail"
),

    # ---------------- Dashboards ---------------- #

    path(
        "admin-dashboard/",
        admin_dashboard,
        name="admin-dashboard"
    ),

    path(
        "academic-manager-dashboard/",
        academic_manager_dashboard,
        name="academic-manager-dashboard"
    ),

    path(
        "faculty-dashboard/",
        faculty_dashboard,
        name="faculty-dashboard"
    ),

    path(
        "student-dashboard/",
        student_dashboard,
        name="student-dashboard"
    ),

    # ---------------- Admin Pages ---------------- #

    path(
        "admin/academic-managers/",
        academic_manager_management,
        name="academic-manager-page"
    ),
    path(
        "admin/faculties/",
        faculty_management,
        name="faculty-page"
    ),
    path(
    "admin/students/",
    student_management,
    name="student-page"
    ),

#new
    path("admin/dashboard/", AdminDashboardStatsView.as_view(), name="admin-dashboard-stats"),
]