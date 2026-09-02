from django import forms

from .models import MentorProfile, MenteeProfile
from .questionnaire_utils import filter_topics_for_subjects
from .subject_catalog import TOPIC_VOCABULARY, get_subject_choices


SUBJECT_CHOICES = get_subject_choices()

TOPIC_CHOICES = [(name, name) for name in TOPIC_VOCABULARY]

ROLE_CHOICES = [
    ("Senior IT Student", "Senior IT Student"),
    ("Instructor", "Instructor"),
]

RATING_CHOICES = [(1, "1"), (2, "2"), (3, "3"), (4, "4"), (5, "5")]


class MentorQuestionnaireForm(forms.ModelForm):
    role = forms.ChoiceField(choices=ROLE_CHOICES, widget=forms.RadioSelect)
    subjects = forms.MultipleChoiceField(
        choices=SUBJECT_CHOICES, widget=forms.CheckboxSelectMultiple
    )
    topics = forms.MultipleChoiceField(
        choices=TOPIC_CHOICES, widget=forms.CheckboxSelectMultiple
    )
    expertise_level = forms.ChoiceField(choices=RATING_CHOICES, widget=forms.RadioSelect)

    class Meta:
        model = MentorProfile
        fields = ("role", "subjects", "topics", "expertise_level")

    def clean(self):
        cleaned_data = super().clean()
        cleaned_data["subjects"] = list(cleaned_data.get("subjects") or [])
        cleaned_data["topics"] = filter_topics_for_subjects(
            cleaned_data.get("subjects"), cleaned_data.get("topics")
        )
        return cleaned_data


class MenteeQuestionnaireForm(forms.ModelForm):
    subjects = forms.MultipleChoiceField(
        choices=SUBJECT_CHOICES, widget=forms.CheckboxSelectMultiple
    )
    topics = forms.MultipleChoiceField(
        choices=TOPIC_CHOICES, widget=forms.CheckboxSelectMultiple
    )
    difficulty_level = forms.ChoiceField(choices=RATING_CHOICES, widget=forms.RadioSelect)

    class Meta:
        model = MenteeProfile
        fields = ("subjects", "topics", "difficulty_level")

    def clean(self):
        cleaned_data = super().clean()
        cleaned_data["subjects"] = list(cleaned_data.get("subjects") or [])
        cleaned_data["topics"] = filter_topics_for_subjects(
            cleaned_data.get("subjects"), cleaned_data.get("topics")
        )
        return cleaned_data
