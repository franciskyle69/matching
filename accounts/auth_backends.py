from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model


class EmailOrUsernameModelBackend(ModelBackend):
    """
    Authenticate with email or username.
    Uses the default Django ModelBackend for permission checks.
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        UserModel = get_user_model()
        # Support identifier, email, or username parameters
        identifier = kwargs.get("identifier") or kwargs.get("email") or username or kwargs.get(UserModel.USERNAME_FIELD)
        
        if identifier is None or password is None:
            return None

        user = None
        
        # Check if identifier looks like an email (contains @) and try email lookup first
        if "@" in identifier:
            try:
                user = UserModel.objects.get(email__iexact=identifier)
            except UserModel.DoesNotExist:
                pass
            except UserModel.MultipleObjectsReturned:
                user = UserModel.objects.filter(email__iexact=identifier).order_by("id").first()
        
        # If not found by email, try by username
        if user is None:
            try:
                user = UserModel.objects.get(username=identifier)
            except UserModel.DoesNotExist:
                return None
        
        if user and user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
