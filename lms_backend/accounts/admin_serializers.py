from rest_framework import serializers
from .models import CustomUser


class AcademicManagerSerializer(serializers.ModelSerializer):

    class Meta:
        model = CustomUser
        fields = [
            "id",
            "username",
            "email",
            "phone",
            "role",
            "password",
        ]
        extra_kwargs = {
            "password": {"write_only": True}
        }

    def create(self, validated_data):
        password = validated_data.pop("password")

        user = CustomUser(**validated_data)
        user.set_password(password)
        user.role = CustomUser.Role.ACADEMIC_MANAGER
        user.save()

        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)

        for key, value in validated_data.items():
            setattr(instance, key, value)

        if password:
            instance.set_password(password)

        instance.save()

        return instance
    

from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


class FacultySerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        style={"input_type": "password"}
    )

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "phone",
            "password",
        ]

    def validate_phone(self, value):
        if not value:
            raise serializers.ValidationError("Phone number is required.")

        if not value.isdigit() or len(value) != 10:
            raise serializers.ValidationError(
                "Phone number must be exactly 10 digits."
            )

        return value

    def create(self, validated_data):
        password = validated_data.pop("password")

        user = User(
            role=User.Role.FACULTY,
            **validated_data
        )

        user.set_password(password)
        user.save()

        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        instance.save()

        return instance
    

class StudentSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        style={"input_type": "password"}
    )

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "phone",
            "password",
        ]

    def validate_phone(self, value):
        if not value:
            raise serializers.ValidationError(
                "Phone number is required."
            )

        if not value.isdigit() or len(value) != 10:
            raise serializers.ValidationError(
                "Phone number must be exactly 10 digits."
            )

        return value

    def create(self, validated_data):
        password = validated_data.pop("password")

        user = User(
            role=User.Role.STUDENT,
            **validated_data
        )

        user.set_password(password)
        user.save()

        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        instance.save()

        return instance
    

#new

class DashboardStatsSerializer(serializers.Serializer):
    total_students = serializers.IntegerField()
    total_faculty = serializers.IntegerField()
    total_academic_managers = serializers.IntegerField()
    total_courses = serializers.IntegerField()
    pending_leave_requests = serializers.IntegerField()