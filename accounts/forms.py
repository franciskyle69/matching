from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User


ROLE_CHOICES = (
    ("mentor", "Mentor"),
    ("mentee", "Mentee"),
)


class RegisterForm(UserCreationForm):
    """
    Extended registration form that lets the user choose
    whether they are signing up as a mentor or a mentee.
    """

    email = forms.EmailField(required=True)
    role = forms.ChoiceField(choices=ROLE_CHOICES, widget=forms.RadioSelect)

    class Meta:
        model = User
        fields = ("username", "email", "password1", "password2", "role")


class AccountSettingsForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ("username", "email")

    def clean_username(self):
        username = self.cleaned_data.get("username", "").strip()
        if not username:
            raise forms.ValidationError("Username is required.")
        qs = User.objects.filter(username__iexact=username).exclude(pk=self.instance.pk)
        if qs.exists():
            raise forms.ValidationError("This username is already taken.")
        return username

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
