from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import FacultyDashboardView, LearningMaterialViewSet, AssignmentViewSet


router = DefaultRouter()
router.register(r"learning-materials", LearningMaterialViewSet, basename="learning-material")
router.register(r"assignments", AssignmentViewSet, basename="assignment")

urlpatterns = [
    path("dashboard/", FacultyDashboardView.as_view(), name="faculty-dashboard"),
    path("", include(router.urls)),
]



