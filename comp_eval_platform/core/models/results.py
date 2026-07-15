"""Normalized run results — one row per (task, tool, benchmark, instance).

The shared, queryable shape every competition reports into; category-specific
fields live in ``extra`` (their column names are on ``Category.result_fields``).
A plugin's ``parse_results`` yields ``ResultRecord``s; ``Result.store`` persists them.
"""
import uuid

from django.db import models


class Result(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey("core.Task", on_delete=models.CASCADE, related_name="results")
    tool = models.ForeignKey("core.Tool", on_delete=models.CASCADE, related_name="results")
    benchmark = models.ForeignKey("core.Benchmark", on_delete=models.CASCADE, related_name="results")
    # Null for a benchmark-level aggregate row.
    instance = models.ForeignKey("core.Instance", on_delete=models.SET_NULL, null=True, blank=True, related_name="results")
    # Denormalized for scoring/queries (a run is within one category).
    category = models.ForeignKey("core.Category", on_delete=models.CASCADE, related_name="results")
    #: Normalized verdict (sat/unsat/holds/violated/unknown/error/timeout/…).
    result = models.CharField(max_length=64, blank=True)
    #: Runtime in seconds.
    time = models.FloatField(null=True, blank=True)
    #: Competition/category-specific fields (see Category.result_fields).
    extra = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "core_result"
        indexes = [models.Index(fields=["tool", "benchmark"])]

    def __str__(self):
        inst = self.instance.name if self.instance else "-"
        return f"{self.tool} / {self.benchmark} / {inst}: {self.result}"

    @classmethod
    def store(cls, task, tool, benchmark, category, records, *, instances_by_name=None):
        """Persist parsed ``ResultRecord``s for a finished run. ``instances_by_name``
        (optional) links each record to its Instance row by name."""
        instances_by_name = instances_by_name or {}
        rows = [
            cls(
                task=task, tool=tool, benchmark=benchmark, category=category,
                instance=instances_by_name.get(r.instance),
                result=r.result, time=r.time, extra=r.extra or {},
            )
            for r in records
        ]
        return cls.objects.bulk_create(rows)
