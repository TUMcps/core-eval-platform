"""DRF serializers for the shared domain. Competition-specific fields ride in the
``extra``/``spec``/``payload`` JSON, so these stay variant-agnostic."""
from rest_framework import serializers

from .models import Benchmark, Category, Instance, Result, Task, TaskStep, Tool, Track, User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "name", "role", "enabled", "is_admin", "is_organizer", "created_at"]
        read_only_fields = ["id", "email", "name", "is_admin", "is_organizer", "created_at"]


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "result_fields", "spec"]


class InstanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Instance
        fields = ["id", "name", "spec", "order"]


class ToolSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tool
        fields = ["id", "owner", "category", "name", "repository", "hash",
                  "base_image", "script_dir", "extra", "published", "created_at"]
        read_only_fields = ["owner", "created_at"]


class BenchmarkSerializer(serializers.ModelSerializer):
    instances = InstanceSerializer(many=True, read_only=True)

    class Meta:
        model = Benchmark
        fields = ["id", "owner", "category", "name", "repository", "hash", "extra",
                  "published", "created_at", "instances"]
        read_only_fields = ["owner", "created_at"]


class TrackSerializer(serializers.ModelSerializer):
    class Meta:
        model = Track
        fields = ["id", "name", "description", "benchmarks", "created_at"]
        read_only_fields = ["created_at"]


class TaskStepSerializer(serializers.ModelSerializer):
    logs = serializers.SerializerMethodField()
    has_logs = serializers.SerializerMethodField()
    can_download_results = serializers.SerializerMethodField()
    results = serializers.SerializerMethodField()
    summary = serializers.SerializerMethodField()
    timeout_hours = serializers.SerializerMethodField()
    timeout_enforced = serializers.SerializerMethodField()

    class Meta:
        model = TaskStep
        fields = ["id", "kind", "order", "status", "started_at", "finished_at", "logs",
                  "has_logs", "can_download_results", "results", "summary",
                  "timeout_hours", "timeout_enforced"]

    def get_timeout_hours(self, obj):
        """The cap this step's timer counts against, or null. Asking the competition
        keeps the frontend from having to know which kinds are capped."""
        from comp_eval_platform.competitions import get_competition

        return get_competition().step_timeout_hours(obj)

    def get_timeout_enforced(self, obj):
        """Whether a cap would actually fire. Reported alongside rather than folded into
        `timeout_hours`, so a configured-but-disabled cap can still be shown, marked."""
        from comp_eval_platform.core.models import RuntimeSettings

        return RuntimeSettings.get().enforce_timeouts

    def get_results(self, obj):
        """The raw results file this step's run produced, shown verbatim. A step that
        collects one records it under this payload key."""
        return (obj.payload or {}).get("results_csv", "")

    def get_summary(self, obj):
        """A step's frozen outcome summary + severity, for steps that compute one
        (e.g. a scoring step reading its scorer's report)."""
        payload = obj.payload or {}
        if "summary" not in payload:
            return None
        return {"summary": payload["summary"], "severity": payload.get("severity", "unknown")}

    def get_can_download_results(self, obj):
        """Whether this step pushed artifacts the owner can download. Asking the
        competition keeps the frontend from having to know which kinds export."""
        from comp_eval_platform.competitions import get_competition
        from comp_eval_platform.core.models.execution import StepStatus

        if obj.status != StepStatus.DONE:
            return False
        return bool(get_competition().exported_artifacts_dir(obj))

    def _latest(self, obj):
        # logs_rel is prefetched by the detail view; a step keeps at most one log
        # (set_log replaces), so read it in Python instead of a per-step query.
        rel = list(obj.logs_rel.all())
        return rel[-1] if rel else None

    def get_logs(self, obj):
        log = self._latest(obj)
        return log.text if log else ""

    def get_has_logs(self, obj):
        return self._latest(obj) is not None


# Our outcomes/step-statuses → VNN's canonical chip labels (constants/status.ts).
_OUTCOME_TO_STATUS = {
    "pending": "Pending", "running": "Running", "succeeded": "Done",
    "failed": "Error", "timed_out": "Timed out", "aborted": "Aborted",
}
_STEP_TO_STATE = {
    "pending": "pending", "active": "running", "done": "success",
    "failed": "error", "aborted": "aborted",
}


class TaskListSerializer(serializers.ModelSerializer):
    """Overview rows: no per-step data (which would trigger a log query per step)."""

    name = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    done = serializers.SerializerMethodField()
    repository = serializers.SerializerMethodField()
    hash = serializers.SerializerMethodField()
    benchmark_progress = serializers.SerializerMethodField()
    user_email = serializers.SerializerMethodField()
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = ["id", "tool", "benchmark", "category", "outcome", "created_at", "name",
                  "status", "done", "repository", "hash", "benchmark_progress",
                  "user_email", "user_name"]
        read_only_fields = fields

    def get_repository(self, obj):
        if obj.benchmark_id:
            return (obj.benchmark.extra or {}).get("repository", "")
        if obj.tool_id:
            return obj.tool.repository
        # A per-category benchmark load carries its repo on the task itself.
        return (obj.extra or {}).get("repository", "")

    def get_hash(self, obj):
        if obj.benchmark_id:
            return (obj.benchmark.extra or {}).get("hash", "")
        if obj.tool_id:
            return obj.tool.hash or ""
        return (obj.extra or {}).get("hash", "")

    def get_name(self, obj):
        if obj.tool_id:
            return obj.tool.name
        if obj.benchmark_id:
            return obj.benchmark.name
        # A per-category benchmark load (ARCH) is identified by its category, not a name.
        if obj.category_id:
            return obj.category.name
        return str(obj.id)[:8]

    def get_status(self, obj):
        return _OUTCOME_TO_STATUS.get(obj.outcome, "Running")

    def get_done(self, obj):
        return obj.done

    def get_user_email(self, obj):
        return obj.owner.email if obj.owner_id else None

    def get_user_name(self, obj):
        return obj.owner.name if obj.owner_id else None

    def get_benchmark_progress(self, obj):
        from .models import Benchmark

        # step_set is prefetched by the viewset, so this touches no extra query
        # for the steps themselves.
        steps = [s for s in obj.step_set.all() if s.kind == "run_benchmark"]
        if not steps:
            return []
        ids = [s.payload.get("benchmark_id") for s in steps if s.payload.get("benchmark_id")]
        names = ({str(k): v for k, v in Benchmark.objects.filter(id__in=ids).values_list("id", "name")}
                 if ids else {})
        return [
            {"name": (s.payload.get("benchmark_name")
                      or names.get(str(s.payload.get("benchmark_id")), "benchmark")),
             "state": _STEP_TO_STATE.get(s.status, "pending"), "step_id": s.order}
            for s in steps
        ]


class TaskSerializer(TaskListSerializer):
    """Full task detail: adds the step list (with logs) for the detail page."""

    steps = TaskStepSerializer(source="step_set", many=True, read_only=True)

    class Meta(TaskListSerializer.Meta):
        fields = TaskListSerializer.Meta.fields + ["owner", "current_step", "total_runtime", "steps"]
        read_only_fields = fields


class ResultSerializer(serializers.ModelSerializer):
    # The FKs serialize as ids; a results table needs the names. Null-safe: a row from
    # before instances were recorded has no instance to name.
    instance_name = serializers.CharField(source="instance.name", read_only=True, default=None)
    benchmark_name = serializers.CharField(source="benchmark.name", read_only=True, default=None)

    class Meta:
        model = Result
        fields = ["id", "task", "tool", "benchmark", "benchmark_name", "instance",
                  "instance_name", "category", "result", "time", "extra", "created_at"]
