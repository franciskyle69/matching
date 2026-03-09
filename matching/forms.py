from django import forms

from .models import Subject, Topic, MentoringSession


class SubjectForm(forms.ModelForm):
    class Meta:
        model = Subject
        fields = ("name", "description")


class MentoringSessionForm(forms.ModelForm):
    scheduled_at = forms.DateTimeField(
        widget=forms.DateTimeInput(attrs={"type": "datetime-local"})
    )

    class Meta:
        model = MentoringSession
        fields = ("mentee", "subject", "topic", "scheduled_at", "duration_minutes", "notes", "status")


class MentoringSessionRescheduleForm(forms.ModelForm):
    scheduled_at = forms.DateTimeField(
        widget=forms.DateTimeInput(attrs={"type": "datetime-local"})
    )

    class Meta:
        model = MentoringSession
        fields = ("subject", "topic", "scheduled_at", "duration_minutes", "notes")
