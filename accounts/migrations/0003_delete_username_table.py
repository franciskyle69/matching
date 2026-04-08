from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_remove_username_unique"),
    ]

    operations = [
        migrations.DeleteModel(name="UserName"),
    ]