"""Durable submission catalog: what users submit and organizers curate.

Deliberately separate from the execution state machine (Task/TaskStep). A Tool
or Benchmark is submitted once and lives on; a Task is one *run* of the machine
that references them. Competition-specific fields live in ``extra`` / ``spec``
JSON, validated by the active plugin's submission spec — so a new variant needs
no core schema change.
"""
import uuid

from django.conf import settings
from django.db import models


class Category(models.Model):
    """A grouping with its own result columns and per-category config.

    ARCH has many (AINNCS, AFF, NLN, …), each with a different instance format /
    parser / scorer; VNN uses a single implicit ``default`` category.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=64, unique=True)
    #: Normalized result column names this category reports (presentation hint).
    result_fields = models.JSONField(default=list, blank=True)
    #: Per-category configuration read by the plugin (instance format, etc.).
    spec = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "core_category"
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name


class Tool(models.Model):
    """A submitted verification tool (durable catalog entry)."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        blank=True, related_name="tools",
    )
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="tools")
    name = models.CharField(max_length=255)
    repository = models.CharField(max_length=512, blank=True)
    hash = models.CharField(max_length=255, blank=True)
    #: Docker image ref (local_docker) or AMI id (aws) — the base the tool runs in.
    base_image = models.CharField(max_length=255, blank=True)
    script_dir = models.CharField(max_length=255, blank=True)
    #: Competition-specific options (run_as_root flags, post-install, versions, …).
    extra = models.JSONField(default=dict, blank=True)
    published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "core_tool"

    def __str__(self):
        return f"{self.name} [{self.category.name}]"


class Benchmark(models.Model):
    """A submitted benchmark: names a set of Instances the tool runs against."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        blank=True, related_name="benchmarks",
    )
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="benchmarks")
    name = models.CharField(max_length=255)
    #: Competition/category-specific benchmark-level config.
    extra = models.JSONField(default=dict, blank=True)
    published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "core_benchmark"
        constraints = [
            models.UniqueConstraint(fields=["category", "name"], name="uniq_benchmark_per_category"),
        ]

    def __str__(self):
        return f"{self.name} [{self.category.name}]"


class Instance(models.Model):
    """One case within a Benchmark. Passed to the node as
    ``run_instance(version, benchmark, instance)``; its ``spec`` carries whatever
    the category needs (onnx+vnnlib+timeout for VNN; per-category fields for ARCH).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    benchmark = models.ForeignKey(Benchmark, on_delete=models.CASCADE, related_name="instances")
    name = models.CharField(max_length=255)
    #: Everything the node needs to run this case (format is category-specific).
    spec = models.JSONField(default=dict, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "core_instance"
        ordering = ["order", "name"]
        constraints = [
            models.UniqueConstraint(fields=["benchmark", "name"], name="uniq_instance_per_benchmark"),
        ]

    def __str__(self):
        return f"{self.benchmark.name}/{self.name}"


class Track(models.Model):
    """An organizer-managed grouping of whole Benchmarks (e.g. test / main /
    extended). Replaces VNN's hardcoded track assignment; names and membership
    are data, editable in the UI by an organizer."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=64, unique=True)
    description = models.TextField(blank=True)
    benchmarks = models.ManyToManyField(Benchmark, related_name="tracks", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "core_track"

    def __str__(self):
        return self.name
