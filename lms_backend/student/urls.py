from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    StudentDashboardView,
    StudentLearningMaterialViewSet,
    StudentAssignmentViewSet,
    StudentSubmissionViewSet,
    StudentExamMarkViewSet,
    StudentAttendanceViewSet,
    StudentLeaveHistoryViewSet,
)

router = DefaultRouter()
router.register(r"learning-materials", StudentLearningMaterialViewSet, basename="student-learning-material")
router.register(r"assignments", StudentAssignmentViewSet, basename="student-assignment")
router.register(r"submissions", StudentSubmissionViewSet, basename="student-submission")
router.register(r"exam-marks", StudentExamMarkViewSet, basename="student-exam-mark")
router.register(r"attendance", StudentAttendanceViewSet, basename="student-attendance")
router.register(r"leave-history", StudentLeaveHistoryViewSet, basename="student-leave-history")

urlpatterns = [
    path("dashboard/", StudentDashboardView.as_view(), name="student-dashboard"),
    path("", include(router.urls)),
]