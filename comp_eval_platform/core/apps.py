from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "comp_eval_platform.core"
    label = "core"
    verbose_name = "Evaluation platform core"
