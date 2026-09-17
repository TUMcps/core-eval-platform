"""DB-backed runtime feature flags — the clean ``CompSettings`` analog.

Singleton row (pk=1). These are admin-toggleable at runtime, unlike the static
Django settings ``ACTIVE_COMPETITION`` (a deployment runs one variant) and
the Django engine settings. ``execution_backend`` and ``max_parallel_nodes`` stay here
so an admin can change them without a redeploy; both are env-seeded on first init.
"""
from django.db import models


class RuntimeSettings(models.Model):
    #: Master scheduler switch: when False, the background job no-ops.
    scheduler_enabled = models.BooleanField(default=False)
    #: Compute axis: "aws" | "local_docker". Read by compute.get_backend().
    execution_backend = models.CharField(max_length=32, default="local_docker")
    #: How many workers run submissions at once; each runs its benchmarks sequentially.
    max_parallel_nodes = models.PositiveIntegerField(default=1)
    #: Imported from VNN; nothing reads them.
    terminate_at_end = models.BooleanField(default=True)
    terminate_on_failure = models.BooleanField(default=True)
    #: When False, only admins may log in.
    allow_non_admin_login = models.BooleanField(default=True)
    #: New signups may log in right away instead of waiting for an admin to enable them.
    auto_enable_users = models.BooleanField(default=False)
    users_can_submit_benchmarks = models.BooleanField(default=False)
    users_can_submit_tools = models.BooleanField(default=False)
    #: Wall-clock backstops, in hours.
    submission_timeout = models.PositiveIntegerField(default=4)
    benchmark_timeout = models.PositiveIntegerField(default=6)
    #: Master switch for the backstops above; when False they are shown but not enforced.
    enforce_timeouts = models.BooleanField(default=True)
    #: Imported from VNN; nothing reads it.
    allow_full_evaluation = models.BooleanField(default=True)

    class Meta:
        db_table = "core_settings"
        verbose_name_plural = "runtime settings"

    def __str__(self):
        return "RuntimeSettings"

    @classmethod
    def get(cls) -> "RuntimeSettings":
        """The singleton row, created with defaults on first access."""
        from django.conf import settings

        obj, _ = cls.objects.get_or_create(
            pk=1, defaults={"max_parallel_nodes": getattr(settings, "MAX_PARALLEL_NODES", 1)})
        return obj
