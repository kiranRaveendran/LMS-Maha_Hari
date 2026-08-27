from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    StudentDashboardView,
    StudentLearningMaterialViewSet,
    StudentAssignmentViewSet,
    StudentSubmissionViewSet,
)

router = DefaultRouter()
router.register(r"learning-materials", StudentLearningMaterialViewSet, basename="student-learning-material")
router.register(r"assignments", StudentAssignmentViewSet, basename="student-assignment")
router.register(r"submissions", StudentSubmissionViewSet, basename="student-submission")

urlpatterns = [
    path("dashboard/", StudentDashboardView.as_view(), name="student-dashboard"),
    path("", include(router.urls)),
]