"""REST API for the shared domain.

Variant-agnostic: submission validation, step-graph building, and scoring are all
delegated to the active competition, so these viewsets never mention VNN or ARCH.
"""
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response

from comp_eval_platform.competitions import get_competition

from .models import Benchmark, Category, Instance, Result, Task, Tool, Track
from .serializers import (
    BenchmarkSerializer,
    CategorySerializer,
    InstanceSerializer,
    ResultSerializer,
    TaskSerializer,
    ToolSerializer,
    TrackSerializer,
)


class IsEnabled(permissions.BasePermission):
    """Authenticated and enabled to submit."""

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and getattr(u, "enabled", False))


class IsOrganizer(permissions.BasePermission):
    def has_permission(self, request, view):
        u = request.user
        if request.method in permissions.SAFE_METHODS:
            return bool(u and u.is_authenticated)
        return bool(u and u.is_authenticated and getattr(u, "is_organizer", False))


def _validate(submission):
    try:
        get_competition().validate_submission(submission)
    except DjangoValidationError as exc:
        raise DRFValidationError(exc.messages)


class ToolViewSet(viewsets.ModelViewSet):
    queryset = Tool.objects.all().order_by("-created_at")
    serializer_class = ToolSerializer
    permission_classes = [IsEnabled]

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["post"])
    def run(self, request, pk=None):
        """Validate the tool against the competition spec, then create and start a
        Task (which builds the step graph and executes the first step)."""
        tool = self.get_object()
        _validate(tool)
        task = Task.objects.create(owner=request.user, tool=tool)
        task.start()
        task.refresh_from_db()  # start() advances the machine on refreshed copies
        return Response(TaskSerializer(task).data, status=201)


class BenchmarkViewSet(viewsets.ModelViewSet):
    queryset = Benchmark.objects.all().order_by("-created_at")
    serializer_class = BenchmarkSerializer
    permission_classes = [IsEnabled]

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["post"])
    def add_instances(self, request, pk=None):
        """Bulk-add instances: body is a list of {name, spec, order}."""
        benchmark = self.get_object()
        created = Instance.objects.bulk_create([
            Instance(benchmark=benchmark, name=i["name"], spec=i.get("spec", {}), order=i.get("order", n))
            for n, i in enumerate(request.data)
        ])
        return Response(InstanceSerializer(created, many=True).data, status=201)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        """Validate against the competition spec and mark the benchmark published."""
        benchmark = self.get_object()
        _validate(benchmark)
        benchmark.published = True
        benchmark.save(update_fields=["published"])
        return Response(BenchmarkSerializer(benchmark).data)


class TrackViewSet(viewsets.ModelViewSet):
    """Organizer-managed track curation (read open to any authenticated user)."""

    queryset = Track.objects.all().order_by("name")
    serializer_class = TrackSerializer
    permission_classes = [IsOrganizer]

    @action(detail=True, methods=["get"])
    def scoreboard(self, request, pk=None):
        """The competition's scoreboard for this track."""
        track = self.get_object()
        board = get_competition().score(track)
        return Response({"columns": board.columns, "rows": board.rows})


class TaskViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Task.objects.all().order_by("-created_at")
    serializer_class = TaskSerializer
    permission_classes = [permissions.IsAuthenticated]


class ResultViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ResultSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Result.objects.all().order_by("-created_at")
        tool = self.request.query_params.get("tool")
        benchmark = self.request.query_params.get("benchmark")
        if tool:
            qs = qs.filter(tool_id=tool)
        if benchmark:
            qs = qs.filter(benchmark_id=benchmark)
        return qs


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all().order_by("name")
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticated]
