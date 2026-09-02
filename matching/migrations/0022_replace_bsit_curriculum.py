from django.db import migrations


def replace_bsit_curriculum(apps, schema_editor):
    from profiles.subject_catalog import apply_curriculum

    apply_curriculum(apps=apps)


def noop(apps, schema_editor):
    return None


class Migration(migrations.Migration):
    dependencies = [
        ("matching", "0021_userpost_shared_from"),
        ("profiles", "0016_verificationdocument"),
    ]

    operations = [
        migrations.RunPython(replace_bsit_curriculum, noop),
    ]
