from django.db import migrations


SQLITE_FORWARD = """
PRAGMA foreign_keys=off;
ALTER TABLE auth_user RENAME TO auth_user_old;
CREATE TABLE auth_user (
    id integer NOT NULL PRIMARY KEY AUTOINCREMENT,
    password varchar(128) NOT NULL,
    last_login datetime NULL,
    is_superuser bool NOT NULL,
    username varchar(150) NOT NULL,
    first_name varchar(150) NOT NULL,
    last_name varchar(150) NOT NULL,
    email varchar(254) NOT NULL,
    is_staff bool NOT NULL,
    is_active bool NOT NULL,
    date_joined datetime NOT NULL
);
INSERT INTO auth_user (
    id,
    password,
    last_login,
    is_superuser,
    username,
    first_name,
    last_name,
    email,
    is_staff,
    is_active,
    date_joined
)
SELECT
    id,
    password,
    last_login,
    is_superuser,
    username,
    first_name,
    last_name,
    email,
    is_staff,
    is_active,
    date_joined
FROM auth_user_old;
DROP TABLE auth_user_old;
PRAGMA foreign_keys=on;
"""

SQLITE_REVERSE = """
PRAGMA foreign_keys=off;
ALTER TABLE auth_user RENAME TO auth_user_old;
CREATE TABLE auth_user (
    id integer NOT NULL PRIMARY KEY AUTOINCREMENT,
    password varchar(128) NOT NULL,
    last_login datetime NULL,
    is_superuser bool NOT NULL,
    username varchar(150) NOT NULL UNIQUE,
    first_name varchar(150) NOT NULL,
    last_name varchar(150) NOT NULL,
    email varchar(254) NOT NULL,
    is_staff bool NOT NULL,
    is_active bool NOT NULL,
    date_joined datetime NOT NULL
);
INSERT INTO auth_user (
    id,
    password,
    last_login,
    is_superuser,
    username,
    first_name,
    last_name,
    email,
    is_staff,
    is_active,
    date_joined
)
SELECT
    id,
    password,
    last_login,
    is_superuser,
    username,
    first_name,
    last_name,
    email,
    is_staff,
    is_active,
    date_joined
FROM auth_user_old;
DROP TABLE auth_user_old;
PRAGMA foreign_keys=on;
"""

POSTGRES_FORWARD = "ALTER TABLE auth_user DROP CONSTRAINT IF EXISTS auth_user_username_key;"
POSTGRES_REVERSE = "ALTER TABLE auth_user ADD CONSTRAINT auth_user_username_key UNIQUE (username);"


def forwards(apps, schema_editor):
    if schema_editor.connection.vendor == "sqlite":
        schema_editor.connection.ensure_connection()
        schema_editor.connection.connection.executescript(SQLITE_FORWARD)
        return
    if schema_editor.connection.vendor == "postgresql":
        with schema_editor.connection.cursor() as cursor:
            cursor.execute(POSTGRES_FORWARD)
        return


def backwards(apps, schema_editor):
    if schema_editor.connection.vendor == "sqlite":
        schema_editor.connection.ensure_connection()
        schema_editor.connection.connection.executescript(SQLITE_REVERSE)
        return
    if schema_editor.connection.vendor == "postgresql":
        with schema_editor.connection.cursor() as cursor:
            cursor.execute(POSTGRES_REVERSE)
        return


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
