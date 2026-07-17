"""REST API for the shared domain.

Variant-agnostic: submission validation, step-graph building, and scoring are all
delegated to the active competition, so these viewsets never mention VNN or ARCH.
"""
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import mixins, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response

from comp_eval_platform.competitions import get_competition
from comp_eval_platform.compute import get_backend
from comp_eval_platform.compute.base import ImageError

from .models import Benchmark, Category, Instance, Result, Task, Tool, Track, User
from .serializers import (
    BenchmarkSerializer,
    CategorySerializer,
    InstanceSerializer,
    ResultSerializer,
    TaskListSerializer,
    TaskSerializer,
    ToolSerializer,
    TrackSerializer,
    UserSerializer,
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
    """The competition's own rules, plus: the active compute backend has to be able to
    boot the requested base image. Rejected here so a submission that could never run
    is refused at submit time instead of failing a task later."""
    try:
        get_competition().validate_submission(submission)
    except DjangoValidationError as exc:
        raise DRFValidationError(exc.messages)
    try:
        get_backend().resolve_image(getattr(submission, "base_image", "") or "")
    except ImageError as exc:
        raise DRFValidationError([str(exc)])


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
    queryset = Benchmark.objects.all().order_by("-created_at").prefetch_related("instances")
    serializer_class = BenchmarkSerializer
    permission_classes = [IsEnabled]

    def create(self, request, *args, **kwargs):
        # Variants without user-chosen categories (VNN) file every benchmark under a
        # single implicit 'default' category. Inject it before validation so the
        # category/name uniqueness check still runs.
        data = request.data
        if not data.get("category") and not get_competition().uses_categories:
            category, _ = Category.objects.get_or_create(name="default")
            data = {**data, "category": str(category.id)}
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(serializer.data, status=201)

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


class TrackViewSet(viewsets.ModelViewSet):
    """Organizer-managed track curation (read open to any authenticated user)."""

    queryset = Track.objects.all().order_by("name").prefetch_related("benchmarks")
    serializer_class = TrackSerializer
    permission_classes = [IsOrganizer]

    @action(detail=True, methods=["get"])
    def scoreboard(self, request, pk=None):
        """The competition's scoreboard for this track."""
        track = self.get_object()
        board = get_competition().score(track)
        return Response({"columns": board.columns, "rows": board.rows})


class TaskViewSet(mixins.DestroyModelMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Task.objects.all().order_by("-created_at")
    serializer_class = TaskSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        # The overview omits per-step data (avoids a log query per step).
        return TaskListSerializer if self.action == "list" else TaskSerializer

    def get_queryset(self):
        qs = (Task.objects.all().order_by("-created_at")
              .select_related("owner", "tool", "benchmark")
              .prefetch_related("step_set"))
        if self.action == "retrieve":
            # The detail page shows per-step logs; prefetch them (list omits steps).
            qs = qs.prefetch_related("step_set__logs_rel")
        u = self.request.user
        return qs if getattr(u, "is_admin", False) else qs.filter(owner=u)

    def _may_manage(self, request, task):
        return request.user.is_admin or task.owner_id == request.user.id

    @action(detail=True, methods=["post"])
    def abort(self, request, pk=None):
        task = self.get_object()
        if not self._may_manage(request, task):
            return Response(status=403)
        task.abort()
        task.refresh_from_db()
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=["post"])
    def resume(self, request, pk=None):
        """Continue a paused task by advancing past its held step."""
        task = self.get_object()
        if not self._may_manage(request, task):
            return Response(status=403)
        if task.current_step is not None:
            task.step_succeeded(check_status=False)
            task.refresh_from_db()
        return Response(TaskSerializer(task).data)

    @action(detail=True, methods=["post"])
    def change_owner(self, request, pk=None):
        """Reassign this submission to another enabled user (admin only)."""
        if not getattr(request.user, "is_admin", False):
            return Response(status=403)
        task = self.get_object()
        user = User.objects.filter(id=request.data.get("owner"), enabled=True).first()
        if user is None:
            return Response({"error": "unknown or disabled user"}, status=400)
        task.owner = user
        task.save(update_fields=["owner"])
        task.refresh_from_db()
        return Response(TaskSerializer(task).data)

    def destroy(self, request, *args, **kwargs):
        """Delete a finished submission (cascades steps/logs/results; the benchmark
        row survives). A running task must be aborted first."""
        task = self.get_object()
        if not self._may_manage(request, task):
            return Response(status=403)
        if not task.done:
            return Response({"error": "Abort the submission before deleting it."}, status=400)
        task.delete()
        return Response(status=204)


class ResultViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ResultSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Ordered by the instance's own order so a run reads in the order it ran, not
        # by write time.
        qs = (Result.objects.all()
              .select_related("instance", "benchmark")
              .order_by("benchmark__name", "instance__order", "created_at"))
        for param, field in (("tool", "tool_id"), ("benchmark", "benchmark_id"), ("task", "task_id")):
            value = self.request.query_params.get(param)
            if value:
                qs = qs.filter(**{field: value})
        return qs


class CategoryViewSet(viewsets.ModelViewSet):
    """Read open to any authenticated user; create/edit is organizer-only."""

    queryset = Category.objects.all().order_by("name")
    serializer_class = CategorySerializer
    permission_classes = [IsOrganizer]


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and getattr(u, "is_admin", False))


class UserViewSet(viewsets.ModelViewSet):
    """Admin user management: list + enable/disable + set role."""

    queryset = User.objects.all().order_by("email")
    serializer_class = UserSerializer
    permission_classes = [IsAdmin]
    http_method_names = ["get", "patch", "head", "options"]
