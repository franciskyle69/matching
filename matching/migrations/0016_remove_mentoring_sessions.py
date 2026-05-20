from django.db import migrations, models
import django.db.models.deletion


def delete_session_comments(apps, schema_editor):
    Comment = apps.get_model("matching", "Comment")
    Comment.objects.filter(session_id__isnull=False).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("matching", "0015_postcomment"),
    ]

    operations = [
        migrations.RunPython(delete_session_comments, migrations.RunPython.noop),
        migrations.RemoveConstraint(
            model_name="comment",
            name="comment_session_xor_announcement",
        ),
        migrations.RemoveIndex(
            model_name="comment",
            name="matching_cmt_session",
        ),
        migrations.RemoveField(
            model_name="comment",
            name="session",
        ),
        migrations.AlterField(
            model_name="comment",
            name="announcement",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="comments",
                to="matching.announcement",
            ),
        ),
        migrations.DeleteModel(
            name="MentoringSession",
        ),
    ]
