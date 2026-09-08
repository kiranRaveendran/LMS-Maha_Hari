from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AcademicManagerLeaveRequestViewSet, AcademicManagerOwnLeaveViewSet

router = DefaultRouter()
router.register(r"leave-requests", AcademicManagerLeaveRequestViewSet, basename="academic-manager-leave-request")
router.register(r"leave-history", AcademicManagerOwnLeaveViewSet, basename="academic-manager-own-leave")

urlpatterns = [
    path("", include(router.urls)),
]