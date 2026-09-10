from rest_framework import serializers

from .models import Fee, Payment


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = [
            "id", "razorpay_order_id", "razorpay_payment_id",
            "amount", "status", "created_at", "verified_at",
        ]
        read_only_fields = fields


class FeeSerializer(serializers.ModelSerializer):
    """Everything read-only — there's no student-facing write path onto
    Fee directly; the only way it changes is via the create-order /
    verify-payment flow in views.py."""
    payments = PaymentSerializer(many=True, read_only=True)

    class Meta:
        model = Fee
        fields = ["id", "amount", "status", "created_at", "paid_at", "payments"]
        read_only_fields = fields
