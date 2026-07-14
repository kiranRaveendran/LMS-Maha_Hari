from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):

    fieldsets = UserAdmin.fieldsets + (
        (
            "LMS Information",
            {
                "fields": (
                    "role",
                    "phone",
                    "profile_image",
                    "employee_id",
                    "gender",
                    "qualification",
                    "joining_date",
                    "address",
                )
            },
        ),
    )

    list_display = (
        "username",
        "first_name",
        "last_name",
        "role",
        "employee_id",
        "email",
        "is_staff",
    )

    list_filter = (
        "role",
        "gender",
        "is_staff",
    )

    search_fields = (
        "username",
        "first_name",
        "last_name",
        "employee_id",
        "email",
    )