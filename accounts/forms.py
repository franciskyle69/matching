from django import forms
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password


ROLE_CHOICES = (
    ("mentor", "Mentor"),
    ("mentee", "Mentee"),
)


CREATE_USER_ROLE_CHOICES = ROLE_CHOICES + (("staff", "Staff"),)


def is_institutional_email(email):
    """Check if email matches one of the configured institutional domains. Returns bool."""
    from django.conf import settings
    allowed_domains = getattr(settings, 'ALLOWED_EMAIL_DOMAINS', [])
    
    if not allowed_domains:
        return True  # No restrictions
    
    email_lower = email.lower()
    return any(email_lower.endswith(domain.lower()) for domain in allowed_domains)


def validate_institutional_email(email):
    """Validate that email matches one of the configured institutional domains. Raises ValidationError."""
    from django.conf import settings
    allowed_domains = getattr(settings, 'ALLOWED_EMAIL_DOMAINS', [])
    
    if allowed_domains:
        if not is_institutional_email(email):
            domains_str = ", ".join(allowed_domains)
            raise forms.ValidationError(
                f"You must sign up with an institutional email address "
                f"({domains_str}). Contact support if this is incorrect."
            )


class RegisterForm(forms.Form):
    """
    Extended registration form that lets the user choose
    whether they are signing up as a mentor or a mentee.
    """

    first_name = forms.CharField(required=True)
    middle_name = forms.CharField(required=False)
    last_name = forms.CharField(required=True)
    email = forms.EmailField(required=True)
    role = forms.ChoiceField(choices=ROLE_CHOICES, widget=forms.RadioSelect)
    student_verification_document = forms.FileField(required=True)
    password1 = forms.CharField(widget=forms.PasswordInput)
    password2 = forms.CharField(widget=forms.PasswordInput)

    MAX_VERIFICATION_DOC_SIZE = 5 * 1024 * 1024  # 5 MB
    ALLOWED_VERIFICATION_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}
    ALLOWED_VERIFICATION_MIME_TYPES = {
        "application/pdf",
        "image/png",
        "image/jpeg",
    }

    def clean_first_name(self):
        first_name = (self.cleaned_data.get("first_name") or "").strip()
        if not first_name:
            raise forms.ValidationError("First name is required.")
        return first_name

    def clean_middle_name(self):
        return (self.cleaned_data.get("middle_name") or "").strip()

    def clean_last_name(self):
        last_name = (self.cleaned_data.get("last_name") or "").strip()
        if not last_name:
            raise forms.ValidationError("Last name is required.")
        return last_name

    def clean_email(self):
        email = (self.cleaned_data.get("email") or "").strip()
        if not email:
            raise forms.ValidationError("Email is required.")
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError("This email is already in use.")
        validate_institutional_email(email)
        return email

    def clean_student_verification_document(self):
        uploaded = self.cleaned_data.get("student_verification_document")
        if not uploaded:
            raise forms.ValidationError("Please upload proof that you are currently enrolled.")

        name = (uploaded.name or "").lower()
        dot = name.rfind(".")
        ext = name[dot:] if dot >= 0 else ""
        if ext not in self.ALLOWED_VERIFICATION_EXTENSIONS:
            raise forms.ValidationError("Upload a PDF, JPG, or PNG file.")

        content_type = (getattr(uploaded, "content_type", "") or "").lower()
        if content_type and content_type not in self.ALLOWED_VERIFICATION_MIME_TYPES:
            raise forms.ValidationError("Only PDF, JPG, or PNG files are allowed.")

        if int(getattr(uploaded, "size", 0) or 0) > self.MAX_VERIFICATION_DOC_SIZE:
            raise forms.ValidationError("File is too large. Maximum size is 5 MB.")

        return uploaded

    def clean(self):
        cleaned_data = super().clean()
        password1 = cleaned_data.get("password1")
        password2 = cleaned_data.get("password2")
        if password1 and password2 and password1 != password2:
            self.add_error("password2", "Passwords do not match.")
        if password2:
            try:
                validate_password(password2)
            except forms.ValidationError as exc:
                self.add_error("password2", exc)
        return cleaned_data

    def save(self, commit: bool = True):
        cleaned = self.cleaned_data
        first_name = cleaned.get("first_name", "")
        last_name = cleaned.get("last_name", "")
        email = cleaned.get("email", "")
        password = cleaned.get("password1", "")

        base_username = "".join(part for part in [first_name, last_name] if part)
        base_username = "".join(ch for ch in base_username.lower() if ch.isalnum())
        if not base_username:
            base_username = email.split("@")[0].lower()

        username = base_username
        suffix = 1
        while User.objects.filter(username=username).exists():
            suffix += 1
            username = f"{base_username}{suffix}"

        user = User(
            username=username,
            email=email,
            first_name=first_name,
            last_name=last_name,
            is_active=False,
        )
        user.set_password(password)
        if commit:
            user.save()
        return user


class CoordinatorCreateUserForm(forms.Form):
    first_name = forms.CharField(required=True)
    middle_name = forms.CharField(required=False)
    last_name = forms.CharField(required=True)
    email = forms.EmailField(required=True)
    role = forms.ChoiceField(choices=CREATE_USER_ROLE_CHOICES, widget=forms.RadioSelect)

    def clean_first_name(self):
        first_name = (self.cleaned_data.get("first_name") or "").strip()
        if not first_name:
            raise forms.ValidationError("First name is required.")
        return first_name

    def clean_middle_name(self):
        return (self.cleaned_data.get("middle_name") or "").strip()

    def clean_last_name(self):
        last_name = (self.cleaned_data.get("last_name") or "").strip()
        if not last_name:
            raise forms.ValidationError("Last name is required.")
        return last_name

    def clean_email(self):
        email = (self.cleaned_data.get("email") or "").strip()
        if not email:
            raise forms.ValidationError("Email is required.")
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError("This email is already in use.")
        validate_institutional_email(email)
        return email


class AccountSettingsForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ("email",)

    def clean_email(self):
        email = (self.cleaned_data.get("email") or "").strip()
        if not email:
            return email
        # Skip uniqueness check when email is unchanged (avoids false "already in use")
        if self.instance.pk and getattr(self.instance, "email", None):
            if email.lower() == (self.instance.email or "").strip().lower():
                return email
        qs = User.objects.filter(email__iexact=email).exclude(pk=self.instance.pk)
        if qs.exists():
            raise forms.ValidationError("This email is already in use.")
        return email


class PasswordChangeWithCodeForm(forms.Form):
    verification_code = forms.CharField(max_length=6, min_length=6)
    new_password1 = forms.CharField(widget=forms.PasswordInput)
    new_password2 = forms.CharField(widget=forms.PasswordInput)

    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop("user", None)
        super().__init__(*args, **kwargs)

    def clean_verification_code(self):
        code = (self.cleaned_data.get("verification_code") or "").strip()
        if not code.isdigit() or len(code) != 6:
            raise forms.ValidationError("Enter a valid 6-digit verification code.")
        return code

    def clean(self):
        cleaned_data = super().clean()
        password1 = cleaned_data.get("new_password1")
        password2 = cleaned_data.get("new_password2")
        if password1 and password2 and password1 != password2:
            self.add_error("new_password2", "Passwords do not match.")
        if password2:
            try:
                validate_password(password2, user=self.user)
            except forms.ValidationError as exc:
                self.add_error("new_password2", exc)
        return cleaned_data


class PasswordChangeCodeRequestForm(forms.Form):
    email = forms.EmailField(required=True)

    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop("user", None)
        super().__init__(*args, **kwargs)

    def clean_email(self):
        email = (self.cleaned_data.get("email") or "").strip()
        if not email:
            raise forms.ValidationError("Email is required.")
        if not self.user or not getattr(self.user, "email", ""):
            return email
        if email.lower() != (self.user.email or "").strip().lower():
            raise forms.ValidationError("Enter the email on your account.")
        return email


class PasswordChangeCodeVerifyForm(forms.Form):
    verification_code = forms.CharField(max_length=6, min_length=6)

    def clean_verification_code(self):
        code = (self.cleaned_data.get("verification_code") or "").strip()
        if not code.isdigit() or len(code) != 6:
            raise forms.ValidationError("Enter a valid 6-digit verification code.")
        return code


class PasswordChangeUpdateForm(forms.Form):
    new_password1 = forms.CharField(widget=forms.PasswordInput)
    new_password2 = forms.CharField(widget=forms.PasswordInput)

    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop("user", None)
        super().__init__(*args, **kwargs)

    def clean(self):
        cleaned_data = super().clean()
        password1 = cleaned_data.get("new_password1")
        password2 = cleaned_data.get("new_password2")
        if password1 and password2 and password1 != password2:
            self.add_error("new_password2", "Passwords do not match.")
        if password2:
            try:
                validate_password(password2, user=self.user)
            except forms.ValidationError as exc:
                self.add_error("new_password2", exc)
        return cleaned_data
