from rest_framework import serializers
from .models import CustomUser


class UserSerializer(serializers.ModelSerializer):
    batch = serializers.StringRelatedField()

    class Meta:
        model = CustomUser
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "role",
            "phone",
            "batch",
            "profile_image",
        ]