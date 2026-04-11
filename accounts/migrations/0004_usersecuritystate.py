from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0003_delete_username_table"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserSecurityState",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "must_change_password",
                    models.BooleanField(default=False, db_column="force_password_change"),
                ),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="security_state",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
    ]
