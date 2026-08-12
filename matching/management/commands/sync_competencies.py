from django.core.management.base import BaseCommand

from matching.models import Topic, Competency


COMPETENCY_MAP = {
    "css": [
        (
            "CSS Selectors",
            "Apply CSS selectors and properties.",
        ),
        (
            "Layout with Flexbox/Grid",
            "Create layouts using Flexbox and Grid.",
        ),
        (
            "Responsive Design",
            "Design responsive web pages.",
        ),
    ],
    "html": [
        (
            "HTML Structure",
            "Create and structure web pages using HTML elements.",
        ),
        (
            "Forms and Inputs",
            "Create forms and input fields.",
        ),
        (
            "Semantic HTML",
            "Use semantic HTML elements appropriately.",
        ),
    ],
    "ui/ux": [
        (
            "User-Friendly Interfaces",
            "Design user-friendly interfaces.",
        ),
        (
            "Wireframes & Prototypes",
            "Create wireframes and prototypes.",
        ),
        (
            "Usability & Accessibility",
            "Apply usability and accessibility principles.",
        ),
    ],
    "arrays": [
        (
            "Array Creation",
            "Create and initialize arrays.",
        ),
        (
            "Array Manipulation",
            "Access, modify, and manipulate array elements.",
        ),
        (
            "Array Iteration",
            "Iterate through arrays using loops.",
        ),
    ],
    "error handling": [
        (
            "Error Identification",
            "Identify and distinguish different types of errors.",
        ),
        (
            "Error Handling Techniques",
            "Implement error-handling techniques.",
        ),
        (
            "Debugging & Troubleshooting",
            "Debug and troubleshoot program errors.",
        ),
    ],
    "input and output handling": [
        (
            "Input Processing",
            "Receive and process user input.",
        ),
        (
            "Input Validation",
            "Validate user input.",
        ),
        (
            "Output Formatting",
            "Display and format program output.",
        ),
    ],
    "javascript": [
        (
            "Variables, Types & Operators",
            "Use variables, data types, and operators.",
        ),
        (
            "Functions",
            "Create and use functions.",
        ),
        (
            "DOM Manipulation",
            "Manipulate webpage elements using JavaScript.",
        ),
    ],
    "loops": [
        (
            "Loop Fundamentals",
            "Implement for, while, and do-while loops.",
        ),
        (
            "Nested Loops",
            "Use nested loops to solve problems.",
        ),
        (
            "Loop Control",
            "Control loop execution using break and continue.",
        ),
    ],
}


def _topic_key(name: str) -> str:
    return str(name or "").strip().lower()


class Command(BaseCommand):
    help = "Backfill competencies for topics using canonical competency map."

    def handle(self, *args, **options):
        _ = (args, options)
        created_count = 0
        touched_topics = 0

        for topic in Topic.objects.select_related("subject").all():
            key = _topic_key(topic.name)
            # Handle both "Javascript" and "JavaScript" spellings.
            if key == "javascript":
                key = "javascript"
            if key not in COMPETENCY_MAP:
                continue

            touched_topics += 1
            for competency_name, competency_description in COMPETENCY_MAP[key]:
                _, created = Competency.objects.get_or_create(
                    topic=topic,
                    name=competency_name,
                    defaults={"description": competency_description},
                )
                if created:
                    created_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Synced competencies for {touched_topics} topic rows. "
                f"Created {created_count} new competencies.",
            )
        )
