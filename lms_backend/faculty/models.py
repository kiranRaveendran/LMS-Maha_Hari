from django.db import models
from django.conf import settings
from academics.models import Course


class LearningMaterial(models.Model):
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="learning_materials"
    )
    title = models.CharField(max_length=200)
    file = models.FileField(upload_to="learning_materials/")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class Assignment(models.Model):
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name="assignments"
    )
    title = models.CharField(max_length=200)
    description = models.TextField()
    due_date = models.DateTimeField()

    def __str__(self):
        return self.title


class Submission(models.Model):
    assignment = models.ForeignKey(
        Assignment,
        on_delete=models.CASCADE,
        related_name="submissions"
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        limit_choices_to={"role": "STUDENT"}
    )
    file = models.FileField(upload_to="submissions/")
    submitted_at = models.DateTimeField(auto_now_add=True)
    grade = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    feedback = models.TextField(blank=True)

    class Meta:
        unique_together = ("assignment", "student")

    def __str__(self):
        return f"{self.assignment.title} - {self.student.username}"


class Attendance(models.Model):
    STATUS_CHOICES = [
        ("PRESENT", "Present"),
        ("ABSENT", "Absent"),
    ]

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        limit_choices_to={"role": "STUDENT"}
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE
    )
    date = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES)

    class Meta:
        unique_together = ("student", "course", "date")

    def __str__(self):
        return f"{self.student.username} - {self.course.name}"


class ExamMark(models.Model):
    EXAM_TYPES = [
        ("INTERNAL", "Internal"),
        ("MODEL", "Model"),
        ("FINAL", "Final"),
    ]

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        limit_choices_to={"role": "STUDENT"}
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE
    )
    exam_type = models.CharField(max_length=20, choices=EXAM_TYPES)
    marks = models.DecimalField(max_digits=5, decimal_places=2)

    class Meta:
        unique_together = ("student", "course", "exam_type")

    def __str__(self):
        return f"{self.student.username} - {self.course.name} ({self.exam_type})"