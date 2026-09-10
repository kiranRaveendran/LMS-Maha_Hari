from django.db import models

# Create your models here.
from django.conf import settings
from django.db import models


class Fee(models.Model):
    """
    A single, one-time fee owed by a student. One row per student —
    there's deliberately no fee-assignment UI anywhere (Admin/Academic
    Manager aren't involved at all): the amount comes from
    settings.DEFAULT_FEE_AMOUNT and this row is created lazily the
    first time a student opens the Fees page — see
    fees.views.StudentFeeView.get_or_create_fee().
    """

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PAID = "PAID", "Paid"

    student = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="fee",
        limit_choices_to={"role": "STUDENT"},
    )

    amount = models.DecimalField(max_digits=10, decimal_places=2)

    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)

    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.student.username} — Rs.{self.amount} ({self.status})"


class Payment(models.Model):
    """
    One row per Razorpay order attempt against a Fee. A student can
    accumulate several rows here (e.g. a FAILED attempt followed by a
    PAID one) even though they only ever have one Fee — this is the
    payment/attempt history, the Fee is just the current balance.
    """

    class Status(models.TextChoices):
        CREATED = "CREATED", "Created"
        PAID = "PAID", "Paid"
        FAILED = "FAILED", "Failed"

    fee = models.ForeignKey(Fee, on_delete=models.CASCADE, related_name="payments")

    razorpay_order_id = models.CharField(max_length=100)
    razorpay_payment_id = models.CharField(max_length=100, blank=True, default="")
    razorpay_signature = models.CharField(max_length=255, blank=True, default="")

    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.CREATED)

    created_at = models.DateTimeField(auto_now_add=True)
    verified_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.razorpay_order_id} — {self.status}"
