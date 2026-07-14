from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        token["username"] = user.username

        if user.is_superuser:
            token["role"] = "SUPERUSER"
        else:
            token["role"] = user.role

        return token

    def validate(self, attrs):
        data = super().validate(attrs)

        role = "SUPERUSER" if self.user.is_superuser else self.user.role

        data["id"] = self.user.id
        data["username"] = self.user.username
        data["email"] = self.user.email
        data["role"] = role

        return data