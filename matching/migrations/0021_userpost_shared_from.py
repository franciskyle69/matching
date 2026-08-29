# Generated manually for UserPost.shared_from

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("matching", "0020_competency"),
    ]

    operations = [
        migrations.AddField(
            model_name="userpost",
            name="shared_from",
            field=models.ForeignKey(
                blank=True,
                help_text="When set, this post is a share of another post shown on the sharer's profile.",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="shares",
                to="matching.userpost",
            ),
        ),
    ]
