from django.contrib.auth.models import AbstractUser
from django.db import models
from django.apps import apps


class CustomUser(AbstractUser):

    class Role(models.TextChoices):
        ACADEMIC_MANAGER = "ACADEMIC_MANAGER", "Academic Manager"
        FACULTY = "FACULTY", "Faculty"
        STUDENT = "STUDENT", "Student"

    class Gender(models.TextChoices):
        MALE = "MALE", "Male"
        FEMALE = "FEMALE", "Female"
        OTHER = "OTHER", "Other"

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        blank=True,
        null=True
    )

    phone = models.CharField(max_length=15, blank=True)

    profile_image = models.ImageField(
        upload_to="profile_images/",
        blank=True,
        null=True
    )

    # -------------------------
    # Professional Fields
    # -------------------------

    employee_id = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
        null=True
    )

    gender = models.CharField(
        max_length=10,
        choices=Gender.choices,
        blank=True
    )

    qualification = models.CharField(
        max_length=150,
        blank=True
    )

    joining_date = models.DateField(
        blank=True,
        null=True
    )

    address = models.TextField(
        blank=True
    )

    @property
    def batch(self):
        if self.role == self.Role.STUDENT:
            Batch = apps.get_model("academics", "Batch")
            return Batch.objects.filter(students=self).first()
        return None

    def __str__(self):
        if self.role:
            return f"{self.username} ({self.role})"
        return self.username