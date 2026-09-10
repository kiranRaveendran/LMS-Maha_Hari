from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    BatchViewSet,
    CourseViewSet,
    StudentCourseViewSet,
    DropdownOptionsView,
    SyllabusTopicViewSet,
    AnnouncementViewSet,
    AcademicManagerDashboardStatsView,
)

router = DefaultRouter()
router.register("batches", BatchViewSet, basename="batches")
router.register("courses", CourseViewSet, basename="courses")
router.register("enrollments", StudentCourseViewSet, basename="enrollments")
router.register("syllabus-topics", SyllabusTopicViewSet, basename="syllabus-topics")
router.register("announcements", AnnouncementViewSet, basename="announcements")

urlpatterns = [
    path("dropdowns/", DropdownOptionsView.as_view(), name="academic-manager-dropdowns"),
    path("dashboard/", AcademicManagerDashboardStatsView.as_view(), name="academic-manager-dashboard"),
    path("", include(router.urls)),
]