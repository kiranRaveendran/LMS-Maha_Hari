from django.db import models
from django.conf import settings


class Feedback(models.Model):
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="feedbacks",
        limit_choices_to={"role": "STUDENT"},
    )

    academic_manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="received_feedbacks",
        limit_choices_to={"role": "ACADEMIC_MANAGER"},
    )

    message = models.TextField(max_length=1000)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.student.username} -> {self.academic_manager.username}"