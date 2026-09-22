from django import forms
from django.contrib.auth import get_user_model
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password


ROLE_CHOICES = (
    ("mentor", "Mentor"),
    ("mentee", "Mentee"),
)

MENTOR_ROLE_CHOICES = (
    ("Senior IT Student", "Senior IT Student (peer mentor)"),
    ("Instructor", "Instructor"),
)


CREATE_USER_ROLE_CHOICES = ROLE_CHOICES + (("both", "Both"), ("staff", "Staff"),)


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
    mentor_role = forms.ChoiceField(
        choices=MENTOR_ROLE_CHOICES,
        required=False,
        widget=forms.RadioSelect,
        label="Mentor type",
    )
    gender = forms.ChoiceField(
        choices=(("", "---------"), ("male", "Male"), ("female", "Female")),
        required=False,
        label="Biological sex",
    )
    year_level = forms.IntegerField(required=False)
    student_verification_document = forms.FileField(required=False)
    password1 = forms.CharField(widget=forms.PasswordInput, required=True)
    password2 = forms.CharField(widget=forms.PasswordInput, required=True)

    MAX_VERIFICATION_DOC_SIZE = 5 * 1024 * 1024  # 5 MB
    MAX_VERIFICATION_FILES_PER_KIND = 10
    ALLOWED_VERIFICATION_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}
    ALLOWED_VERIFICATION_MIME_TYPES = {
        "application/pdf",
        "image/png",
        "image/jpeg",
    }
    STUDENT_MENTOR_DOCUMENT_FIELDS = (
        ("letter_of_intent", "Letter of intent"),
        ("study_load", "Study load"),
        ("grade", "Grade"),
    )

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

    def _uploaded_files(self, field_name):
        if not self.files:
            return []
        return [uploaded for uploaded in self.files.getlist(field_name) if uploaded]

    def _verification_file_error(self, uploaded):
        name = (getattr(uploaded, "name", "") or "").lower()
        dot = name.rfind(".")
        ext = name[dot:] if dot >= 0 else ""
        if ext not in self.ALLOWED_VERIFICATION_EXTENSIONS:
            return "Upload a PDF, JPG, or PNG file."

        content_type = (getattr(uploaded, "content_type", "") or "").lower()
        if content_type and content_type not in self.ALLOWED_VERIFICATION_MIME_TYPES:
            return "Only PDF, JPG, or PNG files are allowed."

        if int(getattr(uploaded, "size", 0) or 0) > self.MAX_VERIFICATION_DOC_SIZE:
            return "File is too large. Maximum size is 5 MB."
        return ""

    def _validate_file_group(self, files, label, field_name=None):
        if not files:
            message = f"{label} is required."
            if field_name:
                self.add_error(field_name, message)
            else:
                self.add_error(None, message)
            return
        if len(files) > self.MAX_VERIFICATION_FILES_PER_KIND:
            message = f"{label}: upload at most {self.MAX_VERIFICATION_FILES_PER_KIND} files."
            if field_name:
                self.add_error(field_name, message)
            else:
                self.add_error(None, message)
            return
        for uploaded in files:
            error = self._verification_file_error(uploaded)
            if error:
                message = f"{label}: {error}"
                if field_name:
                    self.add_error(field_name, message)
                else:
                    self.add_error(None, message)

    def clean_student_verification_document(self):
        uploaded = self.cleaned_data.get("student_verification_document")
        if not uploaded:
            return uploaded
        error = self._verification_file_error(uploaded)
        if error:
            raise forms.ValidationError(error)
        return uploaded

    def clean_mentor_role(self):
        return (self.cleaned_data.get("mentor_role") or "").strip()

    def clean_gender(self):
        return (self.cleaned_data.get("gender") or "").strip().lower()

    def clean_password1(self):
        password1 = self.cleaned_data.get("password1") or ""
        if not password1:
            raise forms.ValidationError("Password is required.")
        return password1

    def clean_password2(self):
        password2 = self.cleaned_data.get("password2") or ""
        if not password2:
            raise forms.ValidationError("Confirm password is required.")
        return password2

    def clean(self):
        cleaned_data = super().clean()
        password1 = cleaned_data.get("password1")
        password2 = cleaned_data.get("password2")
        if not password1:
            self.add_error("password1", "Password is required.")
        if not password2:
            self.add_error("password2", "Confirm password is required.")
        if password1 and password2 and password1 != password2:
            self.add_error("password2", "Passwords do not match.")
        if password2:
            try:
                validate_password(password2)
            except forms.ValidationError as exc:
                self.add_error("password2", exc)
        role = cleaned_data.get("role")
        mentor_role = cleaned_data.get("mentor_role")
        gender = (cleaned_data.get("gender") or "").strip().lower()
        if role == "mentor" and not mentor_role:
            self.add_error(
                "mentor_role",
                "Select whether you are signing up as a student mentor or an instructor.",
            )
        if role == "mentor" and gender not in ("male", "female"):
            self.add_error("gender", "Select your biological sex.")
        year_level = cleaned_data.get("year_level")
        if role == "mentor" and mentor_role == "Senior IT Student":
            if year_level not in (3, 4):
                self.add_error(
                    "year_level",
                    "Select whether you are a 3rd year or 4th year student mentor.",
                )
        elif role == "mentor":
            cleaned_data["year_level"] = 4
        else:
            cleaned_data["year_level"] = None
        if role == "mentee" and mentor_role:
            cleaned_data["mentor_role"] = ""
        if role != "mentor":
            cleaned_data["gender"] = ""

        is_student_mentor = role == "mentor" and mentor_role == "Senior IT Student"
        if is_student_mentor:
            files_by_kind = {}
            for field_name, label in self.STUDENT_MENTOR_DOCUMENT_FIELDS:
                files = self._uploaded_files(field_name)
                self._validate_file_group(files, label)
                files_by_kind[field_name] = files
            cleaned_data["verification_files_by_kind"] = files_by_kind
            first = next(
                (uploaded for files in files_by_kind.values() for uploaded in files),
                None,
            )
            cleaned_data["student_verification_document"] = first
        else:
            files = self._uploaded_files("student_verification_document")
            self._validate_file_group(
                files,
                "Academic mentoring application form",
                field_name="student_verification_document",
            )
            cleaned_data["verification_files_by_kind"] = {"application": files}
            cleaned_data["student_verification_document"] = files[0] if files else None
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
    password = forms.CharField(required=False, max_length=128)

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


class PeerLinkPasswordResetForm(forms.Form):
    """Robust password reset form supporting email, username, or student ID lookup."""

    email_or_username = forms.CharField(
        label="Email or Username",
        max_length=254,
        required=True,
        widget=forms.TextInput(
            attrs={
                "id": "id_email_or_username",
                "autocomplete": "username",
                "placeholder": "you@student.buksu.edu.ph or username",
                "class": "form-control",
                "autofocus": True,
            }
        ),
    )

    def clean_email_or_username(self):
        query = (self.cleaned_data.get("email_or_username") or "").strip()
        if not query:
            raise forms.ValidationError("Please enter your registered email address or username.")
        return query

    def get_users(self, query):
        User = get_user_model()
        # 1. Match by email (case-insensitive)
        users = list(User.objects.filter(email__iexact=query, is_active=True))
        if users:
            return users

        # 2. Match by username (case-insensitive)
        users = list(User.objects.filter(username__iexact=query, is_active=True))
        if users:
            return users

        # 3. Match by student ID number in UserProfile or MenteeProfile
        users = list(User.objects.filter(profile__student_id_no__iexact=query, is_active=True))
        if users:
            return users
        users = list(User.objects.filter(mentee_profile__student_id_no__iexact=query, is_active=True))
        if users:
            return users

        # 4. Check allauth EmailAddress table
        try:
            from allauth.account.models import EmailAddress

            ea = EmailAddress.objects.filter(email__iexact=query).select_related("user").first()
            if ea and ea.user and ea.user.is_active:
                return [ea.user]
        except Exception:
            pass

        # 5. Dev fallback: if query matches EMAIL_HOST_USER, link to dev/superuser account
        from django.conf import settings

        host_user = (getattr(settings, "EMAIL_HOST_USER", "") or "").strip().lower()
        if host_user and query.lower() == host_user:
            dev_user = (
                User.objects.filter(username="franciskylearranchado").first()
                or User.objects.filter(is_superuser=True).first()
            )
            if dev_user:
                return [dev_user]

        return []

    def clean(self):
        cleaned_data = super().clean()
        query = cleaned_data.get("email_or_username")
        if query:
            matching_users = self.get_users(query)
            if not matching_users:
                raise forms.ValidationError(
                    f"No active account found for '{query}'. Please check your spelling or verify your BukSU institutional email."
                )
            cleaned_data["matching_users"] = matching_users
        return cleaned_data

    def save(
        self,
        domain_override=None,
        subject_template_name="registration/password_reset_subject.txt",
        email_template_name="registration/password_reset_email.html",
        use_https=False,
        token_generator=None,
        from_email=None,
        request=None,
        html_email_template_name="registration/password_reset_email_html.html",
        extra_email_context=None,
    ):
        import os
        import re
        import logging
        from django.contrib.auth.tokens import default_token_generator
        from django.core.mail import EmailMultiAlternatives
        from django.template.loader import render_to_string
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode
        from capstone_site.site_utils import sync_site_from_env

        logger = logging.getLogger(__name__)
        token_gen = token_generator or default_token_generator
        query = self.cleaned_data.get("email_or_username")
        users = self.cleaned_data.get("matching_users") or self.get_users(query)
        if not users:
            logger.warning("password_reset_no_users", extra={"query": query})
            return 0

        sync_site_from_env()

        # Dynamic clean base URL from FRONTEND_URL environment variable
        raw_url = os.getenv("FRONTEND_URL", "https://peerlink.online")
        frontend_url = re.sub(r"[()\[\]'\"\s]+", "", str(raw_url or "https://peerlink.online")).rstrip("/")
        if not frontend_url:
            frontend_url = "https://peerlink.online"

        if "://" in frontend_url:
            default_protocol, default_domain = frontend_url.split("://", 1)
        else:
            default_protocol, default_domain = "https", frontend_url

        domain = domain_override or default_domain
        protocol = "https" if use_https else default_protocol

        from django.conf import settings

        sender_email = (
            from_email
            or getattr(settings, "DEFAULT_FROM_EMAIL", None)
            or getattr(settings, "EMAIL_HOST_USER", None)
        )

        sent_count = 0
        for user in users:
            dest_email = user.email
            if not dest_email and query and "@" in query:
                dest_email = query

            if not dest_email:
                continue

            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = token_gen.make_token(user)
            reset_url = f"{frontend_url}/accounts/reset/{uid}/{token}/"

            context = {
                "email": dest_email,
                "domain": domain,
                "site_name": "PeerLink",
                "uid": uid,
                "user": user,
                "token": token,
                "protocol": protocol,
                "reset_url": reset_url,
                **(extra_email_context or {}),
            }

            subject = "Reset your PeerLink password"
            try:
                text_content = render_to_string(email_template_name, context)
            except Exception:
                text_content = (
                    f"Hi {user.get_full_name() or user.username},\n\n"
                    f"Click the link below to reset your PeerLink password:\n"
                    f"{reset_url}\n\n"
                    f"If you did not request this, you can safely ignore this email.\n"
                )

            html_content = None
            if html_email_template_name:
                try:
                    html_content = render_to_string(html_email_template_name, context)
                except Exception as exc:
                    logger.warning("password_reset_html_render_failed", extra={"error": str(exc)})

            msg = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=sender_email,
                to=[dest_email],
            )
            if html_content:
                msg.attach_alternative(html_content, "text/html")

            try:
                msg.send(fail_silently=False)
                sent_count += 1
                logger.info("password_reset_sent", extra={"user_id": user.id, "email": dest_email})
            except Exception as exc:
                logger.exception("password_reset_send_failed", extra={"user_id": user.id, "email": dest_email, "error": str(exc)})
                raise forms.ValidationError(
                    f"Unable to send reset email to {dest_email} due to a mail server connection error. Please try again shortly."
                )

        return sent_count
