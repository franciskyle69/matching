import django.db.models.deletion
from django.db import migrations, models


def seed_competencies(apps, schema_editor):
    Topic = apps.get_model("matching", "Topic")
    Competency = apps.get_model("matching", "Competency")

    competency_map = {
        "Arrays": [
            ("Array Creation", "Create and initialize arrays correctly."),
            ("Array Manipulation", "Add, update, and remove array elements."),
            ("Array Iteration", "Traverse arrays using loops and callbacks."),
            ("Array Searching", "Find items in arrays using common search patterns."),
            ("Array Sorting", "Sort arrays with built-in or custom logic."),
        ],
        "Loops": [
            ("Loop Basics", "Use for and while loops for repeated work."),
            ("Nested Loops", "Combine loops for grid and multi-step problems."),
            ("Loop Control", "Use break and continue appropriately."),
            ("Iteration Patterns", "Choose the right iteration pattern for a task."),
        ],
        "Input and Output Handling": [
            ("Input Validation", "Check and clean user input before processing."),
            ("Console Output", "Display clear output and prompts."),
            ("File Handling", "Read from and write to files safely."),
            ("Parsing Data", "Convert raw text input into usable data."),
        ],
        "Error Handling": [
            ("Error Identification", "Recognize common programming errors."),
            ("Exception Handling", "Catch and handle exceptions properly."),
            ("Debugging", "Trace issues and isolate the cause of failures."),
            ("Logging", "Record useful runtime information for troubleshooting."),
        ],
        "Javascript": [
            ("Variables & Data Types", "Declare variables and understand basic types."),
            ("Functions", "Write reusable functions with clear inputs and outputs."),
            ("DOM Manipulation", "Read and update page elements from JavaScript."),
            ("Event Handling", "Respond to clicks, input, and other browser events."),
            ("Async Basics", "Work with promises and asynchronous code."),
        ],
        "HTML": [
            ("Semantic Elements", "Use meaningful HTML elements for structure."),
            ("Forms", "Build forms with the right inputs and labels."),
            ("Tables", "Create accessible data tables."),
            ("Media Elements", "Embed images, audio, and video correctly."),
        ],
        "CSS": [
            ("Selectors", "Target elements using classes, ids, and combinators."),
            ("Layout", "Arrange content with modern layout techniques."),
            ("Flexbox", "Use flexbox for one-dimensional layouts."),
            ("Responsive Design", "Adapt layouts for different screen sizes."),
            ("Styling Basics", "Apply color, spacing, and typography well."),
        ],
        "UI/UX": [
            ("Wireframing", "Sketch interface structure before implementation."),
            ("Prototyping", "Build interactive mockups for feedback."),
            ("Accessibility", "Design interfaces that work for more people."),
            ("Usability", "Make flows easy to understand and complete."),
            ("Visual Hierarchy", "Guide attention with layout and emphasis."),
        ],
    }

    topic_map = {topic.name: topic for topic in Topic.objects.all()}
    for topic_name, competencies in competency_map.items():
        topic = topic_map.get(topic_name)
        if not topic:
            continue
        for competency_name, description in competencies:
            Competency.objects.get_or_create(
                topic=topic,
                name=competency_name,
                defaults={"description": description},
            )


def unseed_competencies(apps, schema_editor):
    Competency = apps.get_model("matching", "Competency")
    Competency.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ("matching", "0019_alter_topic_options_topic_created_at_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="Competency",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=150)),
                ("description", models.TextField(blank=True, default="")),
                ("topic", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="competencies", to="matching.topic")),
            ],
            options={
                "ordering": ["topic__name", "name"],
                "unique_together": {("topic", "name")},
            },
        ),
        migrations.RunPython(seed_competencies, unseed_competencies),
    ]