from django.db import migrations


def add_difficulty_level(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'profiles_menteeprofile'
                      AND column_name = 'difficulty_level'
                ) THEN
                    ALTER TABLE profiles_menteeprofile
                    ADD COLUMN difficulty_level SMALLINT;
                END IF;
            END $$;
        """)


def reverse_difficulty_level(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute("ALTER TABLE profiles_menteeprofile DROP COLUMN IF EXISTS difficulty_level;")


class Migration(migrations.Migration):
    dependencies = [
        ("profiles", "0017_profile_completion_and_mentor_student_id"),
    ]

    operations = [
        migrations.RunPython(add_difficulty_level, reverse_difficulty_level),
    ]
