from django.apps import AppConfig
from django.conf import settings


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "comp_eval_platform.core"
    label = "core"
    verbose_name = "Evaluation platform core"

    def ready(self):
        # Register core step handlers (import side effect populates the registry).
        from comp_eval_platform.core import steps  # noqa: F401

        # Start the background scheduler only in the web process, not under
        # makemigrations/tests/shell. Variants set SCHEDULER_AUTOSTART=True for the
        # server process.
        if getattr(settings, "SCHEDULER_AUTOSTART", False):
            from comp_eval_platform.core.scheduler import start_scheduler

            start_scheduler()
