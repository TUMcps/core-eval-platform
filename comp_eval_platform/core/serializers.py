"""DRF serializers for the shared domain. Competition-specific fields ride in the
``extra``/``spec``/``payload`` JSON, so these stay variant-agnostic."""
from rest_framework import serializers

from .models import Benchmark, Category, Instance, Result, Task, TaskStep, Tool, Track


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
    class Meta:
        model = TaskStep
        fields = ["id", "kind", "order", "status", "started_at", "finished_at"]


class TaskSerializer(serializers.ModelSerializer):
    steps = TaskStepSerializer(source="step_set", many=True, read_only=True)

    class Meta:
        model = Task
        fields = ["id", "owner", "tool", "benchmark", "outcome", "current_step",
                  "total_runtime", "created_at", "steps"]
        read_only_fields = fields


class ResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = Result
        fields = ["id", "task", "tool", "benchmark", "instance", "category",
                  "result", "time", "extra", "created_at"]
