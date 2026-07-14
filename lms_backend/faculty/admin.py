from django.contrib import admin
from .models import (
    LearningMaterial,
    Assignment,
    Submission,
    Attendance,
    ExamMark,
)

admin.site.register(LearningMaterial)
admin.site.register(Assignment)
admin.site.register(Submission)
admin.site.register(Attendance)
admin.site.register(ExamMark)