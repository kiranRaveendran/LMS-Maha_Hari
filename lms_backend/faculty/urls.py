from django.urls import path, include
from rest_framework.routers import DefaultRouter

# from .views import FacultyDashboardView, LearningMaterialViewSet, AssignmentViewSet, SubmissionViewSet, AttendanceViewSet, ExamMarkViewSet, FacultyLeaveHistoryViewSet


# router = DefaultRouter()
# router.register(r"learning-materials", LearningMaterialViewSet, basename="learning-material")
# router.register(r"assignments", AssignmentViewSet, basename="assignment")
# router.register(r"submissions", SubmissionViewSet, basename="submission")
# router.register(r"attendance", AttendanceViewSet, basename="attendance")
# router.register(r"exam-marks", ExamMarkViewSet, basename="exam-mark")
# router.register(r"leave-history", FacultyLeaveHistoryViewSet, basename="leave-history")


from .views import (
    FacultyDashboardView, LearningMaterialViewSet, AssignmentViewSet,
    SubmissionViewSet, AttendanceViewSet, ExamMarkViewSet,
    FacultyLeaveHistoryViewSet, StudentLeaveRequestViewSet
)

router = DefaultRouter()
router.register(r"learning-materials", LearningMaterialViewSet, basename="learning-material")
router.register(r"assignments", AssignmentViewSet, basename="assignment")
router.register(r"submissions", SubmissionViewSet, basename="submission")
router.register(r"attendance", AttendanceViewSet, basename="attendance")
router.register(r"exam-marks", ExamMarkViewSet, basename="exam-mark")
router.register(r"leave-history", FacultyLeaveHistoryViewSet, basename="leave-history")
router.register(r"student-leave-requests", StudentLeaveRequestViewSet, basename="student-leave-request")

urlpatterns = [
    path("dashboard/", FacultyDashboardView.as_view(), name="faculty-dashboard"),
    path("", include(router.urls)),
]
