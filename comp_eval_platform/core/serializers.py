"""DRF serializers for the shared domain. Competition-specific fields ride in the
``extra``/``spec``/``payload`` JSON, so these stay variant-agnostic."""
from rest_framework import serializers

from .models import Benchmark, Category, Instance, Result, Task, TaskStep, Tool, Track, User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "role", "enabled", "is_admin", "is_organizer", "created_at"]
        read_only_fields = ["id", "email", "is_admin", "is_organizer", "created_at"]


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
        fields = ["id", "owner", "category", "name", "extra", "published",
                  "created_at", "instances"]
        read_only_fields = ["owner", "created_at"]


class TrackSerializer(serializers.ModelSerializer):
    class Meta:
        model = Track
        fields = ["id", "name", "description", "benchmarks", "created_at"]
        read_only_fields = ["created_at"]


class TaskStepSerializer(serializers.ModelSerializer):
    logs = serializers.CharField(read_only=True)
    has_logs = serializers.SerializerMethodField()

    class Meta:
        model = TaskStep
        fields = ["id", "kind", "order", "status", "started_at", "finished_at", "logs", "has_logs"]

    def get_has_logs(self, obj):
        return bool(obj.logs)


# Our outcomes/step-statuses → VNN's canonical chip labels (constants/status.ts).
_OUTCOME_TO_STATUS = {
    "pending": "Pending", "running": "Running", "succeeded": "Done",
    "failed": "Error", "timed_out": "Timed out", "aborted": "Aborted",
}
_STEP_TO_STATE = {
    "pending": "pending", "active": "running", "done": "success",
    "failed": "error", "aborted": "aborted",
}


class TaskSerializer(serializers.ModelSerializer):
    steps = TaskStepSerializer(source="step_set", many=True, read_only=True)
    name = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    done = serializers.SerializerMethodField()
    benchmark_progress = serializers.SerializerMethodField()
    user_email = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = ["id", "owner", "tool", "benchmark", "outcome", "current_step",
                  "total_runtime", "created_at", "steps", "name", "status", "done",
                  "benchmark_progress", "user_email"]
        read_only_fields = fields

    def get_name(self, obj):
        if obj.tool_id:
            return obj.tool.name
        if obj.benchmark_id:
            return obj.benchmark.name
        return str(obj.id)[:8]

    def get_status(self, obj):
        return _OUTCOME_TO_STATUS.get(obj.outcome, "Running")

    def get_done(self, obj):
        return obj.done

    def get_user_email(self, obj):
        return obj.owner.email if obj.owner_id else None

    def get_benchmark_progress(self, obj):
        from .models import Benchmark

        steps = [s for s in obj.step_set.all() if s.kind == "run_benchmark"]
        if not steps:
            return []
        ids = [s.payload.get("benchmark_id") for s in steps if s.payload.get("benchmark_id")]
        names = {str(k): v for k, v in Benchmark.objects.filter(id__in=ids).values_list("id", "name")}
        return [
            {"name": (s.payload.get("benchmark_name")
                      or names.get(str(s.payload.get("benchmark_id")), "benchmark")),
             "state": _STEP_TO_STATE.get(s.status, "pending"), "step_id": s.order}
            for s in steps
        ]


class ResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = Result
        fields = ["id", "task", "tool", "benchmark", "instance", "category",
                  "result", "time", "extra", "created_at"]
