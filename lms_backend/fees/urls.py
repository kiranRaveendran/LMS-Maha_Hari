from django.urls import path

from .views import StudentFeeView, CreateRazorpayOrderView, VerifyRazorpayPaymentView

urlpatterns = [
    path("student/fee/", StudentFeeView.as_view(), name="student-fee"),
    path("student/fee/create-order/", CreateRazorpayOrderView.as_view(), name="student-fee-create-order"),
    path("student/fee/verify-payment/", VerifyRazorpayPaymentView.as_view(), name="student-fee-verify-payment"),
]
