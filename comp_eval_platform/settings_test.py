"""Test settings: base settings on an in-memory SQLite DB with a registered test
competition. Used by pytest (and for generating migrations off a serverless DB)."""
from comp_eval_platform.settings import *  # noqa: F401,F403

DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
ACTIVE_COMPETITION = "test"
SCHEDULER_AUTOSTART = False
SECRET_KEY = "test-secret"
# Plain static storage: the manifest backend needs a collectstatic run tests don't do.
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}
