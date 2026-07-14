from django.contrib import admin
from .models import (
    Batch,
    Course,
    StudentCourse,
    SyllabusTopic,
    Announcement,
)

admin.site.register(Batch)
admin.site.register(Course)
admin.site.register(StudentCourse)
admin.site.register(SyllabusTopic)
admin.site.register(Announcement)