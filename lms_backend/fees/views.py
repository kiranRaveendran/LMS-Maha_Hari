from django.shortcuts import render

# Create your views here.
from django.conf import settings
from django.utils import timezone

import razorpay

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status as http_status

from accounts.permissions import IsStudent

from .models import Fee, Payment
from .serializers import FeeSerializer


def get_razorpay_client():
    return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


def get_or_create_fee(student):
    """
    Every student gets exactly one Fee row, created the first time they
    open the Fees page — not by an Admin/Academic Manager, per the
    product decision behind this feature. The amount comes from
    settings.DEFAULT_FEE_AMOUNT.
    """
    fee, _ = Fee.objects.get_or_create(
        student=student,
        defaults={"amount": settings.DEFAULT_FEE_AMOUNT},
    )
    return fee


class StudentFeeView(APIView):
    """GET /api/student/fee/ — the student's fee balance + their payment attempt history."""
    permission_classes = [IsAuthenticated, IsStudent]

    def get(self, request):
        fee = get_or_create_fee(request.user)
        return Response(FeeSerializer(fee).data)


class CreateRazorpayOrderView(APIView):
    """
    POST /api/student/fee/create-order/

    Creates a Razorpay order for the student's current fee balance and a
    local Payment row to track it. Returns everything the frontend needs
    to open Razorpay Checkout — note key_id (the public Key ID) is
    returned, never RAZORPAY_KEY_SECRET.
    """
    permission_classes = [IsAuthenticated, IsStudent]

    def post(self, request):

        fee = get_or_create_fee(request.user)

        if fee.status == Fee.Status.PAID:
            return Response(
                {"detail": "This fee has already been paid."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        amount_paise = int(fee.amount * 100)

        try:
            client = get_razorpay_client()
            order = client.order.create({
                "amount": amount_paise,
                "currency": "INR",
                "payment_capture": 1,
            })
        except Exception as exc:
            return Response(
                {"detail": f"Could not create Razorpay order: {exc}"},
                status=http_status.HTTP_502_BAD_GATEWAY,
            )

        payment = Payment.objects.create(
            fee=fee,
            razorpay_order_id=order["id"],
            amount=fee.amount,
            status=Payment.Status.CREATED,
        )

        return Response({
            "order_id": order["id"],
            "amount": amount_paise,
            "currency": "INR",
            "key_id": settings.RAZORPAY_KEY_ID,
            "student_name": request.user.get_full_name() or request.user.username,
            "student_email": request.user.email,
            "payment_row_id": payment.id,
        })


class VerifyRazorpayPaymentView(APIView):
    """
    POST /api/student/fee/verify-payment/
    Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }

    The frontend gets these three values from Razorpay's success
    callback, but a client-side "success" is never trusted on its own —
    the signature is re-verified here, server-side, against
    RAZORPAY_KEY_SECRET before anything is marked paid.
    """
    permission_classes = [IsAuthenticated, IsStudent]

    def post(self, request):

        order_id = request.data.get("razorpay_order_id")
        payment_id = request.data.get("razorpay_payment_id")
        signature = request.data.get("razorpay_signature")

        if not all([order_id, payment_id, signature]):
            return Response(
                {"detail": "Missing Razorpay payment details."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        try:
            payment = Payment.objects.select_related("fee").get(
                razorpay_order_id=order_id,
                fee__student=request.user,
            )
        except Payment.DoesNotExist:
            return Response(
                {"detail": "No matching payment found."},
                status=http_status.HTTP_404_NOT_FOUND,
            )

        client = get_razorpay_client()

        try:
            client.utility.verify_payment_signature({
                "razorpay_order_id": order_id,
                "razorpay_payment_id": payment_id,
                "razorpay_signature": signature,
            })
        except razorpay.errors.SignatureVerificationError:
            payment.status = Payment.Status.FAILED
            payment.razorpay_payment_id = payment_id
            payment.razorpay_signature = signature
            payment.save()
            return Response(
                {"detail": "Payment verification failed."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        payment.status = Payment.Status.PAID
        payment.razorpay_payment_id = payment_id
        payment.razorpay_signature = signature
        payment.verified_at = timezone.now()
        payment.save()

        fee = payment.fee
        fee.status = Fee.Status.PAID
        fee.paid_at = timezone.now()
        fee.save()

        return Response(FeeSerializer(fee).data)
