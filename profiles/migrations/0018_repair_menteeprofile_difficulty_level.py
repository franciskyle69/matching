from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("profiles", "0017_profile_completion_and_mentor_student_id"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
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
            """,
            reverse_sql="""
            ALTER TABLE profiles_menteeprofile
            DROP COLUMN IF EXISTS difficulty_level;
            """,
        ),
    ]
