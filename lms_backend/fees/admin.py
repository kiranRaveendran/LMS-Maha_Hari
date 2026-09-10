from django.contrib import admin

# Register your models here.
from django.contrib import admin

from .models import Fee, Payment

admin.site.register(Fee)
admin.site.register(Payment)
