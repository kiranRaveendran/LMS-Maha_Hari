from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import StudentFeedbackViewSet, AcademicManagerFeedbackViewSet

router = DefaultRouter()
router.register(r"student/feedback", StudentFeedbackViewSet, basename="student-feedback")
router.register(r"academic-manager/feedback", AcademicManagerFeedbackViewSet, basename="academic-manager-feedback")

urlpatterns = [
    path("", include(router.urls)),
]
