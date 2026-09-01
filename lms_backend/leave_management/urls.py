from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AcademicManagerLeaveRequestViewSet

router = DefaultRouter()
router.register(r"leave-requests", AcademicManagerLeaveRequestViewSet, basename="academic-manager-leave-request")

urlpatterns = [
    path("", include(router.urls)),
]