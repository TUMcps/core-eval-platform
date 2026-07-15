"""DB-backed runtime feature flags — the clean ``VNNCompSettings`` analog.

Singleton row (pk=1). These are admin-toggleable at runtime, unlike the static
Django settings ``ACTIVE_COMPETITION`` (a deployment runs one variant) and
``MAX_PARALLEL_NODES``. ``execution_backend`` stays here so an admin can flip
aws↔local_docker without a redeploy; it is env-seeded on first init.
"""
from django.db import models


class RuntimeSettings(models.Model):
    #: Master scheduler switch: when False, the background job no-ops.
    scheduler_enabled = models.BooleanField(default=False)
    #: Compute axis: "aws" | "local_docker". Read by compute.get_backend().
    execution_backend = models.CharField(max_length=32, default="local_docker")
    terminate_at_end = models.BooleanField(default=True)
    terminate_on_failure = models.BooleanField(default=True)
    allow_non_admin_login = models.BooleanField(default=True)
    users_can_submit_benchmarks = models.BooleanField(default=False)
    users_can_submit_tools = models.BooleanField(default=False)
    #: Wall-clock backstops, in hours.
    submission_timeout = models.PositiveIntegerField(default=4)
    benchmark_timeout = models.PositiveIntegerField(default=6)
    #: Master switch for the backstops above; when False they are shown but not enforced.
    enforce_timeouts = models.BooleanField(default=True)
    #: Whether the full (final) evaluation run mode may be selected by non-admins.
    allow_full_evaluation = models.BooleanField(default=True)

    class Meta:
        db_table = "core_settings"
        verbose_name_plural = "runtime settings"

    def __str__(self):
        return "RuntimeSettings"

    @classmethod
    def get(cls) -> "RuntimeSettings":
        """The singleton row, created with defaults on first access."""
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
